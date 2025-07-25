/**
 * DTO for creating/updating alert rules.
 */
export interface AlertRuleDTO {
  name: string;
  condition: {
    field: string; // e.g. "level"
    operator: "equals" | "contains";
    value: string;
  };
  threshold: {
    count: number;
    durationMinutes: number;
  };
  isActive?: boolean;
}
