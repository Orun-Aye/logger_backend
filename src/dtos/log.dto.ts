// src/dtos/log.dto.ts

import { LogSortByField } from "../services/log.service";

/**
 * @description DTO for creating a new log entry
 */
export interface CreateLogDTO {
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG' | 'TRACE' | 'FATAL';
  projectId: string; // Required for associating logs with a project
  data?: Record<string, any>; // Optional: Additional data to log
  error?: {
    name: string;
    message: string;
    stack?: string; // Optional: Stack trace for errors
  }; // Optional: Error details if applicable
  context?: Record<string, any>; // Optional: Contextual information
  message: string;
  service: string;
  environment: 'development' | 'staging' | 'production';
  metadata?: Record<string, any>;
  timestamp?: string; // Optional: Defaults to server timestamp
}

/**
 * @description DTO for filtering logs via query params
 */
export interface FilterLogsDTO {
  level?: string;
  service?: string;
  environment?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: LogSortByField;
  sortOrder?: 'asc' | 'desc';
}
