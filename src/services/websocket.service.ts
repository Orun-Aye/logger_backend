// src/services/websocket.service.ts
// @ts-nocheck

import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { IncomingMessage } from 'http';
import { DashboardService } from './dashboard.service'; // We will create this below
import { DashboardWebSocketMessage } from '../dtos/websocket.dto';

// Extend the WebSocket type to include user data
interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  projectId: string | null;
}

export class DashboardWebSocketService {
  private wss: WebSocketServer;
  private readonly jwtSecret: string;
  // A map to keep track of connections by project ID
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  constructor(server: any, jwtSecret: string) {
    this.wss = new WebSocketServer({ server });
    this.jwtSecret = jwtSecret;
    this.init();
  }

  // Initializes the WebSocket server and its event handlers
  public init() {
    this.wss.on('connection', this.handleConnection);
    console.log('WebSocket server initialized.');
  }

  // Handle a new incoming WebSocket connection
  private handleConnection = async (ws: WebSocket, req: IncomingMessage) => {
    // Authenticate the user from the JWT token in the connection URL
    const token = new URL(req.url || '/', `http://${req.headers.host}`).searchParams.get('token');
    const authWs = ws as AuthenticatedWebSocket;
    
    try {
      if (!token) {
        throw new Error('Authentication token is required.');
      }
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      authWs.userId = decoded.userId;
      
      console.log(`User ${authWs.userId} connected.`);

      
      authWs.on('message', (message) => this.handleMessage(authWs, message));
      authWs.on('close', () => this.handleClose(authWs));
      authWs.on('error', (err) => console.error('WebSocket error:', err));
      
      // Send a welcome message with a list of projects the user can access
      const projects = await DashboardService.getUserProjectList(authWs.userId);
      const welcomeMessage: DashboardWebSocketMessage = {
        type: 'INITIAL_DATA',
        payload: { projects },
      };
      authWs.send(JSON.stringify(welcomeMessage));
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      authWs.send(JSON.stringify({ type: 'AUTH_ERROR', message: (error as Error).message }));
      authWs.close();
    }
  };

  // Handle incoming messages from a client
  private handleMessage = (ws: AuthenticatedWebSocket, message: string) => {
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.type === 'SUBSCRIBE_TO_PROJECT') {
        const projectId = parsedMessage.payload.projectId;
        this.subscribeClientToProject(ws, projectId);
      } else if (parsedMessage.type === 'UNSUBSCRIBE_FROM_PROJECT') {
        const projectId = parsedMessage.payload.projectId;
        this.unsubscribeClientFromProject(ws, projectId);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', message);
    }
  };

  // Handle client disconnection
  private handleClose = (ws: AuthenticatedWebSocket) => {
    console.log(`User ${ws.userId} disconnected.`);
    // Clean up the client from all project subscriptions
    this.clients.forEach((clientSet) => {
      if (clientSet.has(ws)) {
        clientSet.delete(ws);
      }
    });
  };

  // Subscribe a client to a project's real-time updates
  private subscribeClientToProject = (ws: AuthenticatedWebSocket, projectId: string) => {
    // If the project ID is new, initialize a new Set for clients
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }
    this.clients.get(projectId)?.add(ws);
    ws.projectId = projectId;
    console.log(`User ${ws.userId} subscribed to project ${projectId}. Total subscribers: ${this.clients.get(projectId)?.size}`);
  };

  // Unsubscribe a client from a project's real-time updates
  private unsubscribeClientFromProject = (ws: AuthenticatedWebSocket, projectId: string) => {
    if (this.clients.has(projectId)) {
      this.clients.get(projectId)?.delete(ws);
      ws.projectId = null;
      console.log(`User ${ws.userId} unsubscribed from project ${projectId}. Remaining subscribers: ${this.clients.get(projectId)?.size}`);
      if (this.clients.get(projectId)?.size === 0) {
        this.clients.delete(projectId); // Clean up empty sets
      }
    }
  };

  /**
   * Broadcasts a message to all clients subscribed to a given project.
   * @param projectId The ID of the project to broadcast to.
   * @param messageType The type of the message (e.g., 'NEW_LOG').
   * @param payload The data to send with the message.
   */
  public broadcastToProject(projectId: string, messageType: DashboardWebSocketMessage['type'], payload: any) {
    const clients = this.clients.get(projectId);
    if (!clients) {
      return;
    }
    
    const message: DashboardWebSocketMessage = {
      type: messageType,
      payload,
    };
    const jsonMessage = JSON.stringify(message);

    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(jsonMessage);
      }
    });
  }
}
