// src/types/dashboard.types.ts
export interface DashboardUser {
  userId: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  projectIds: string[];
  permissions: string[];
}

export interface DashboardResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  filters?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

