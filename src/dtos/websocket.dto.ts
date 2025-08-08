// src/dtos/websocket.dto.ts

/**
 * @description Defines the message structure for WebSocket communication.
 */
export interface DashboardWebSocketMessage {
  type: 'INITIAL_DATA' | 'NEW_LOG' | 'PROJECT_UPDATE' | 'AUTH_ERROR' | 'SUBSCRIBE_TO_PROJECT' | 'UNSUBSCRIBE_FROM_PROJECT' | 'NOTIFICATION';
  payload?: any;
}

/**
 * @description DTO for the message sent when a new log is created.
 */
export interface NewLogPayload {
  projectId: string;
  log: any; // The new log object
}

/**
 * @description DTO for the message sent when a project's health changes.
 */
export interface ProjectUpdatePayload {
  projectId: string;
  projectUpdate: {
    isActive: boolean;
    logCount: number;
    lastActivity: Date | null;
    errorRate24h: number;
  };
}
