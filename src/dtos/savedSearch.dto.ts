// src/dtos/savedSearch.dto.ts

export interface CreateSavedSearchDTO {
  name: string;
  description?: string;
  filters: {
    levels?: string[];
    services?: string[];
    environments?: string[];
    eventTypes?: string[];
    search?: string;
    timeRange?: {
      start?: string;
      end?: string;
      preset?: string;
    };
    customFilters?: Record<string, any>;
  };
  isDefault?: boolean;
  isShared?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface UpdateSavedSearchDTO {
  name?: string;
  description?: string;
  filters?: {
    levels?: string[];
    services?: string[];
    environments?: string[];
    eventTypes?: string[];
    search?: string;
    timeRange?: {
      start?: string;
      end?: string;
      preset?: string;
    };
    customFilters?: Record<string, any>;
  };
  isDefault?: boolean;
  isShared?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface SavedSearchResponseDTO {
  _id: string;
  projectId: string;
  userId: string;
  name: string;
  description?: string;
  filters: {
    levels?: string[];
    services?: string[];
    environments?: string[];
    eventTypes?: string[];
    search?: string;
    timeRange?: {
      start?: string;
      end?: string;
      preset?: string;
    };
    customFilters?: Record<string, any>;
  };
  isDefault: boolean;
  isShared: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  createdAt: string;
  updatedAt: string;
}

export interface BatchLogDTO {
  logs: Array<{
    timestamp?: string;
    level: string;
    message: string;
    data?: Record<string, any>;
    error?: {
      name: string;
      message: string;
      stack?: string;
      url?: string;
      lineNumber?: number;
      columnNumber?: number;
    };
    service?: string;
    environment?: string;
    context?: Record<string, any>;
    metadata?: any;
    eventType?: string;
    userAgent?: string;
    url?: string;
    referrer?: string;
    correlationId?: string;
    sessionId?: string;
    traceId?: string;
    spanId?: string;
    release?: string;
  }>;
}

export interface BatchLogResponseDTO {
  success: number;
  failed: number;
  results: Array<{
    index: number;
    success: boolean;
    logId?: string;
    error?: string;
  }>;
}

export interface ExportLogsQueryDTO {
  format: "csv" | "json";
  levels?: string[];
  services?: string[];
  environments?: string[];
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}
