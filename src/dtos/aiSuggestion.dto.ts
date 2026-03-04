export interface AlertSuggestion {
  condition: {
    level?: string;
    keyword?: string;
    frequency?: number;
    intervalMinutes?: number;
    service?: string;
    environment?: string;
    responseTimeThreshold?: number;
    eventType?: string;
  };
  suggestedName: string;
  reason: string;
  confidence: number;
  priority: "high" | "medium" | "low";
}

export interface AcceptSuggestionDTO {
  name: string;
  description?: string;
  condition: Record<string, any>;
  notifyChannels?: string[];
}
