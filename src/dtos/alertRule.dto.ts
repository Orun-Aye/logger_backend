import { Types } from "mongoose";

/**
 * DTO for creating/updating alert rules.
 */
export interface CreateAlertRuleDTO {
  name: string;
  projectId:  Types.ObjectId;
  condition: {
    level: string; // e.g. "level"
    threshold: number;
    timeWindowMinutes: number;
  };
  isActive?: boolean;
  notifyVia?: string[];
  notificationConfig?: object;
}

export interface UpdateAlertRuleDTO {
  name?: string;
  projectId: Types.ObjectId
  condition?: {
    level: string;
    threshold: number;
    timeWindowMinutes: number;
  };
  isActive?: boolean;
  notifyVia?: string[];
  notificationConfig?: object;
}
