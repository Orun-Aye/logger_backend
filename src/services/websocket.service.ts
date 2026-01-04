// src/services/websocket.service.ts
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { DashboardService } from "./dashboard.service";
import { DashboardWebSocketMessage } from "../dtos/websocket.dto";

// Extend the Socket type to include user data if needed,
// but Socket.io sockets are dynamic, so we can attach properties directly or use a typed interface.
interface AuthenticatedSocket extends Socket {
  userId?: string;
  projectId?: string | null;
}

export class DashboardWebSocketService {
  public io: Server;
  private readonly jwtSecret: string;

  // A map to keep track of connections by project ID
  // Socket.io has 'rooms', so we can use that instead of manual maps for projects!
  // We'll still keep a map for user targeting if we want to be explicit,
  // but Socket.io allows io.to(socketId).emit or io.to(room).emit.
  // To target a user by userId, we can join them to a room named `user:${userId}`.

  constructor(httpServer: any, jwtSecret: string) {
    this.io = new Server(httpServer, {
      cors: {
        origin: "*", // Adjust as needed for security
        methods: ["GET", "POST"],
      },
    });
    this.jwtSecret = jwtSecret;
    this.init();
  }

  public init() {
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
          return next(new Error("Authentication token is required."));
        }
        const decoded = jwt.verify(token as string, this.jwtSecret) as {
          userId: string;
        };
        socket.userId = decoded.userId;
        next();
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });

    this.io.on("connection", this.handleConnection);
    console.log("Socket.io server initialized.");
  }

  private handleConnection = async (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    console.log(`User ${userId} connected via Socket.io.`);

    // Join a room specific to this user for targeted notifications
    socket.join(userId);

    // Send initial data
    try {
      const projects = await DashboardService.getUserProjectList(userId);
      socket.emit("message", {
        type: "INITIAL_DATA",
        payload: { projects },
      });
    } catch (error) {
      console.error("Error fetching initial data for socket:", error);
    }

    socket.on("message", (data: any) => this.handleMessage(socket, data));

    socket.on("disconnect", () => {
      console.log(`User ${userId} disconnected.`);
    });
  };

  private handleMessage = (socket: AuthenticatedSocket, data: any) => {
    try {
      // If data is string, parse it, otherwise assume it's object (Socket.io parses JSON auto)
      const parsedMessage = typeof data === "string" ? JSON.parse(data) : data;

      if (parsedMessage.type === "SUBSCRIBE_TO_PROJECT") {
        const projectId = parsedMessage.payload.projectId;
        socket.join(projectId);
        console.log(`User ${socket.userId} subscribed to project ${projectId}`);
      } else if (parsedMessage.type === "UNSUBSCRIBE_FROM_PROJECT") {
        const projectId = parsedMessage.payload.projectId;
        socket.leave(projectId);
        console.log(
          `User ${socket.userId} unsubscribed from project ${projectId}`
        );
      }
    } catch (error) {
      console.error("Failed to handle socket message:", error);
    }
  };

  public broadcastToProject(
    projectId: string,
    messageType: string,
    payload: any
  ) {
    this.io.to(projectId).emit("message", {
      type: messageType,
      payload,
    });
  }

  public sendToUser(userId: string, messageType: string, payload: any) {
    this.io.to(userId).emit("notification", {
      type: messageType,
      ...payload, // Flatten payload or keep structure depending on client expectation.
      // Previous implementation sent { type, payload }.
      // Let's stick to the previous structure for consistency if possible,
      // or adapt. The notification service sends 'notification' event.
    });
    // Actually, in the previous implementation:
    // globalServices.dashboardWebSocketService.sendToUser(userId, 'NOTIFICATION', notification);
    // And sendToUser did: client.send(JSON.stringify({ type: messageType, payload }));
    // So the client received a message with type='NOTIFICATION' and payload=notification object.

    // With Socket.io, we can emit a named event 'notification' directly, or a generic 'message' event.
    // The previous code in NotificationService did:
    // globalServices.dashboardWebSocketService.sendToUser(userId, 'NOTIFICATION', notification);

    // Let's make this sendToUser emit a custom event if provided, or default to 'message'.
    // But to maintain compatibility with the "type" property in the payload:
    this.io.to(userId).emit("message", {
      type: messageType,
      payload,
    });

    // Also emit a specific 'notification' event for easier client handling if they prefer
    if (messageType === "NOTIFICATION") {
      this.io.to(userId).emit("notification", payload);
    }
  }
}
