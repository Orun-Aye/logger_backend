// Shared time range parsing utility
// Extracted from AnalyticsService for reuse across services

export function parseTimeRange(timeRange: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  let startDate = new Date();

  const match = timeRange.match(/^(\d+)([hdwm])$/);
  if (!match) {
    startDate.setHours(startDate.getHours() - 24);
    return { startDate, endDate };
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "h":
      startDate.setHours(startDate.getHours() - value);
      break;
    case "d":
      startDate.setDate(startDate.getDate() - value);
      break;
    case "w":
      startDate.setDate(startDate.getDate() - value * 7);
      break;
    case "m":
      startDate.setMonth(startDate.getMonth() - value);
      break;
  }

  return { startDate, endDate };
}

export function getPreviousPeriod(startDate: Date, endDate: Date): { start: Date; end: Date } {
  const duration = endDate.getTime() - startDate.getTime();
  return {
    start: new Date(startDate.getTime() - duration),
    end: new Date(startDate.getTime()),
  };
}
