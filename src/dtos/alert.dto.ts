import { Types } from "mongoose";

// === Alert Rule DTOs ===

/**
 * Simple condition (backward compatible)
 */
export interface SimpleConditionDTO {
  level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  keyword?: string;
  frequency?: number;
  intervalMinutes?: number;
  service?: string;
  environment?: string;
  responseTimeThreshold?: number;
  eventType?: string;
}

/**
 * Composite condition with AND/OR logic (Phase 2.2)
 */
export interface CompositeConditionDTO {
  operator: "AND" | "OR";
  conditions: SimpleConditionDTO[];
  frequency?: number;
  intervalMinutes?: number;
}

/**
 * DTO for creating alert rules (supports both simple and composite conditions)
 */
export interface CreateAlertRuleDTO {
  name: string;
  description?: string;
  projectId: string | Types.ObjectId;
  condition: SimpleConditionDTO | CompositeConditionDTO;
  isActive?: boolean;
  notifyChannels?: ("email" | "slack" | "webhook" | "github")[];
  notificationConfig?: {
    emails?: string[];
    slackWebhookUrl?: string;
    webhookUrl?: string;
  };
  escalationPolicyId?: string | Types.ObjectId;
  createdBy?: string | Types.ObjectId;
}

/**
 * DTO for updating alert rules
 */
export interface UpdateAlertRuleDTO {
  name?: string;
  description?: string;
  condition?: SimpleConditionDTO | CompositeConditionDTO;
  isActive?: boolean;
  notifyChannels?: ("email" | "slack" | "webhook" | "github")[];
  notificationConfig?: {
    emails?: string[];
    slackWebhookUrl?: string;
    webhookUrl?: string;
  };
  escalationPolicyId?: string | Types.ObjectId;
}

/**
 * DTO for snoozing an alert rule
 */
export interface SnoozeAlertRuleDTO {
  durationMinutes: number;
  userId?: string;
}

/**
 * DTO for testing an alert rule
 */
export interface TestAlertRuleDTO {
  ruleId: string;
  limitLogs?: number;
}

// === Alert Event DTOs ===

/**
 * DTO for updating alert status
 */
export interface UpdateAlertStatusDTO {
  status: "acknowledged" | "resolved" | "snoozed";
  userId?: string;
  resolutionNotes?: string;
  snoozeDurationMinutes?: number;
}

/**
 * DTO for bulk updating alerts
 */
export interface BulkUpdateAlertsDTO {
  alertIds: string[];
  status: "acknowledged" | "resolved" | "snoozed";
  userId?: string;
  resolutionNotes?: string;
}

/**
 * DTO for alert analytics query
 */
export interface AlertAnalyticsQueryDTO {
  projectId: string;
  timeRange?: "1d" | "7d" | "30d";
}

/**
 * DTO for alert timeline query
 */
export interface AlertTimelineQueryDTO {
  projectId: string;
  startDate: string | Date;
  endDate: string | Date;
}

// === Escalation Policy DTOs ===

/**
 * Escalation level definition
 */
export interface EscalationLevelDTO {
  level: number;
  delayMinutes: number;
  notifyChannels: ("email" | "slack" | "webhook" | "github")[];
  recipients: string[];
  webhookUrl?: string;
}

/**
 * DTO for creating escalation policy
 */
export interface CreateEscalationPolicyDTO {
  projectId: string | Types.ObjectId;
  name: string;
  description?: string;
  levels: EscalationLevelDTO[];
  isActive?: boolean;
  createdBy: string | Types.ObjectId;
}

/**
 * DTO for updating escalation policy
 */
export interface UpdateEscalationPolicyDTO {
  name?: string;
  description?: string;
  levels?: EscalationLevelDTO[];
  isActive?: boolean;
}

// === Maintenance Window DTOs ===

/**
 * DTO for creating maintenance window
 */
export interface CreateMaintenanceWindowDTO {
  projectId: string | Types.ObjectId;
  name: string;
  description?: string;
  startTime: string | Date;
  endTime: string | Date;
  reason?: string;
  affectedServices?: string[];
  affectedEnvironments?: string[];
  suppressAllAlerts?: boolean;
  createdBy: string | Types.ObjectId;
}

/**
 * DTO for updating maintenance window
 */
export interface UpdateMaintenanceWindowDTO {
  name?: string;
  description?: string;
  startTime?: string | Date;
  endTime?: string | Date;
  reason?: string;
  affectedServices?: string[];
  affectedEnvironments?: string[];
  suppressAllAlerts?: boolean;
  isActive?: boolean;
}

/**
 * DTO for querying maintenance windows
 */
export interface MaintenanceWindowQueryDTO {
  projectId: string;
  isActive?: boolean;
  includeExpired?: boolean;
}
