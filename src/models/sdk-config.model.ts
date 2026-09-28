import { Schema, model, Document } from 'mongoose';

export interface ISDKConfig extends Document {
  projectId: string;
  minLogLevel: string;
  batchSize: number;
  flushIntervalMs: number;
  environment?: string;
  serviceName?: string;
  // Auto-capture settings
  autoCapture: {
    errors: boolean;
    performance: boolean;
    userInteractions: boolean;
    networkRequests: boolean;
    consoleMessages: boolean;
    pageViews: boolean;
  };
  
  // Sanitization settings
  sanitization: {
    enabled: boolean;
    strictMode: 'STRICT' | 'BALANCED' | 'LENIENT';
    presetConfig?: {
      auditEnabled?: boolean;
      anonymizationEnabled?: boolean;
      sensitiveFields?: string[];
      retentionPolicy?: {
        maxAge?: number;
        maxSize?: number;
        autoDelete?: boolean;
        archiveBeforeDelete?: boolean;
      };
    };
    customRules: Array<{
      pattern: string;
      replacement: string;
      description: string;
      severity: string;
      category: string;
    }>;
  };
  
  // Session replay, set from the dashboard. The SDK reads it at startup
  // unless the app's code sets replay.enabled itself.
  replay: {
    enabled: boolean;
    sampleRate: number;
  };

  updatedAt: Date;
  createdAt: Date;
}

const SDKConfigSchema = new Schema<ISDKConfig>({
  projectId: { type: String, required: true, unique: true, index: true },
  minLogLevel: { type: String, default: 'info' },
  batchSize: { type: Number, default: 10, min: 1, max: 100 },
  flushIntervalMs: { type: Number, default: 5000, min: 1000, max: 60000 },
  environment: { type: String },
  serviceName: { type: String },
  
  autoCapture: {
    errors: { type: Boolean, default: true },
    performance: { type: Boolean, default: true },
    userInteractions: { type: Boolean, default: false },
    networkRequests: { type: Boolean, default: true },
    consoleMessages: { type: Boolean, default: false },
    pageViews: { type: Boolean, default: true }
  },
  
  sanitization: {
    enabled: { type: Boolean, default: true },
    strictMode: { type: String, enum: ['STRICT', 'BALANCED', 'LENIENT'], default: 'BALANCED' },
    presetConfig: {
      auditEnabled: { type: Boolean, default: false },
      anonymizationEnabled: { type: Boolean, default: false },
      sensitiveFields: { type: Array, default: [] },
      retentionPolicy: {
        maxAge: { type: Number, default: 30 },
        maxSize: { type: Number, default: 10 },
        autoDelete: { type: Boolean, default: false },
        archiveBeforeDelete: { type: Boolean, default: false }
      }
    },
    customRules: [{
      pattern: { type: String },
      replacement: { type: String },
      description: { type: String },
      severity: { type: String },
      category: { type: String }
    }]
  },

  replay: {
    enabled: { type: Boolean, default: false },
    sampleRate: { type: Number, default: 0.1, min: 0, max: 1 }
  }
}, { timestamps: true });

export const SDKConfigModel = model<ISDKConfig>('SDKConfig', SDKConfigSchema);
