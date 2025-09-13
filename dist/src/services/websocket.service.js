"use strict";
// src/services/websocket.service.ts
// @ts-nocheck
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardWebSocketService = void 0;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dashboard_service_1 = require("./dashboard.service"); // We will create this below
class DashboardWebSocketService {
    wss;
    jwtSecret;
    // A map to keep track of connections by project ID
    clients = new Map();
    constructor(server, jwtSecret) {
        this.wss = new ws_1.WebSocketServer({ server });
        this.jwtSecret = jwtSecret;
        this.init();
    }
    // Initializes the WebSocket server and its event handlers
    init() {
        this.wss.on('connection', this.handleConnection);
        console.log('WebSocket server initialized.');
    }
    // Handle a new incoming WebSocket connection
    handleConnection = async (ws, req) => {
        // Authenticate the user from the JWT token in the connection URL
        const token = new URL(req.url || '/', `http://${req.headers.host}`).searchParams.get('token');
        const authWs = ws;
        try {
            if (!token) {
                throw new Error('Authentication token is required.');
            }
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            authWs.userId = decoded.userId;
            console.log(`User ${authWs.userId} connected.`);
            authWs.on('message', (message) => this.handleMessage(authWs, message));
            authWs.on('close', () => this.handleClose(authWs));
            authWs.on('error', (err) => console.error('WebSocket error:', err));
            // Send a welcome message with a list of projects the user can access
            const projects = await dashboard_service_1.DashboardService.getUserProjectList(authWs.userId);
            const welcomeMessage = {
                type: 'INITIAL_DATA',
                payload: { projects },
            };
            authWs.send(JSON.stringify(welcomeMessage));
        }
        catch (error) {
            console.error('WebSocket authentication failed:', error);
            authWs.send(JSON.stringify({ type: 'AUTH_ERROR', message: error.message }));
            authWs.close();
        }
    };
    // Handle incoming messages from a client
    handleMessage = (ws, message) => {
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'SUBSCRIBE_TO_PROJECT') {
                const projectId = parsedMessage.payload.projectId;
                this.subscribeClientToProject(ws, projectId);
            }
            else if (parsedMessage.type === 'UNSUBSCRIBE_FROM_PROJECT') {
                const projectId = parsedMessage.payload.projectId;
                this.unsubscribeClientFromProject(ws, projectId);
            }
        }
        catch (error) {
            console.error('Failed to parse WebSocket message:', message);
        }
    };
    // Handle client disconnection
    handleClose = (ws) => {
        console.log(`User ${ws.userId} disconnected.`);
        // Clean up the client from all project subscriptions
        this.clients.forEach((clientSet) => {
            if (clientSet.has(ws)) {
                clientSet.delete(ws);
            }
        });
    };
    // Subscribe a client to a project's real-time updates
    subscribeClientToProject = (ws, projectId) => {
        // If the project ID is new, initialize a new Set for clients
        if (!this.clients.has(projectId)) {
            this.clients.set(projectId, new Set());
        }
        this.clients.get(projectId)?.add(ws);
        ws.projectId = projectId;
        console.log(`User ${ws.userId} subscribed to project ${projectId}. Total subscribers: ${this.clients.get(projectId)?.size}`);
    };
    // Unsubscribe a client from a project's real-time updates
    unsubscribeClientFromProject = (ws, projectId) => {
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
    broadcastToProject(projectId, messageType, payload) {
        const clients = this.clients.get(projectId);
        if (!clients) {
            return;
        }
        const message = {
            type: messageType,
            payload,
        };
        const jsonMessage = JSON.stringify(message);
        clients.forEach(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(jsonMessage);
            }
        });
    }
}
exports.DashboardWebSocketService = DashboardWebSocketService;
