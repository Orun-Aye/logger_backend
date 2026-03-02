import { Types } from "mongoose";

/**
 * DTO for creating/updating alert rules.
 */
export interface CreateAlertRuleDTO {
  name: string;
  projectId:  Types.ObjectId;
  condition: {
    level: string; // e.g. "level"
    keyword: string;
    frequency?: number;
    intervalMinutes: number;
  };
  isActive?: boolean;
  notifyChannels?: string[];
  notificationConfig?: object;
}

export interface UpdateAlertRuleDTO {
  name?: string;
  projectId: Types.ObjectId
  condition?: {
    level: string; // e.g. "level"
    keyword: string;
    frequency?: number;
    intervalMinutes: number;
  };
  isActive?: boolean;
  notifyChannels?: string[];
  notificationConfig?: object;
}
