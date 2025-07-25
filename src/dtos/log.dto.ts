export interface LogDTO {
  timestamp?: string; // Optional: use server time if missing
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  source: string;
  metadata?: Record<string, any>;
}