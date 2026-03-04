export interface DashboardWidgetDTO {
  id?: string;
  type: "chart" | "counter" | "table" | "heatmap" | "log-stream" | "alert-list";
  title: string;
  config: {
    metric?: string;
    projectId?: string;
    timeRange?: string;
    filters?: Record<string, any>;
    chartType?: "line" | "bar" | "pie" | "area";
    refreshInterval?: number;
  };
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface CreateCustomDashboardDTO {
  name: string;
  description?: string;
  widgets?: DashboardWidgetDTO[];
  isDefault?: boolean;
  isShared?: boolean;
  tags?: string[];
}

export interface UpdateCustomDashboardDTO {
  name?: string;
  description?: string;
  isDefault?: boolean;
  isShared?: boolean;
  tags?: string[];
}

export interface UpdateLayoutDTO {
  widgets: DashboardWidgetDTO[];
}
