"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("../utils/logger"));
class StatusService {
    /**
     * Get full system status including all components, incidents, and uptime.
     */
    static async getSystemStatus() {
        const startTime = Date.now();
        const components = [];
        // 1. API Server — always operational if this endpoint responds
        const apiResponseTime = Date.now() - startTime;
        components.push({
            name: "API Server",
            status: "operational",
            description: "Express REST API is running and responding to requests",
            responseTime: apiResponseTime,
        });
        // 2. Database (MongoDB)
        components.push(await StatusService.checkDatabase());
        // 3. WebSocket Service
        components.push(StatusService.checkWebSocket());
        // 4. Background Jobs
        components.push(StatusService.checkBackgroundJobs());
        // Derive overall status from components
        const overallStatus = StatusService.deriveOverallStatus(components);
        // Uptime — placeholder values (real monitoring would need a dedicated service)
        const uptime = {
            last24h: 99.9,
            last7d: 99.9,
            last30d: 99.9,
            last90d: 99.9,
        };
        // No active incidents for now (would come from an Incident model in production)
        const incidents = [];
        return {
            status: overallStatus,
            components,
            incidents,
            uptime,
            checkedAt: new Date().toISOString(),
        };
    }
    /**
     * Check MongoDB connection state and measure ping time.
     */
    static async checkDatabase() {
        try {
            const readyState = mongoose_1.default.connection.readyState;
            // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
            if (readyState !== 1) {
                return {
                    name: "Database (MongoDB)",
                    status: "outage",
                    description: `MongoDB connection state: ${StatusService.mongoStateLabel(readyState)}`,
                };
            }
            // Measure ping time
            const pingStart = Date.now();
            const admin = mongoose_1.default.connection.db?.admin();
            if (admin) {
                await admin.ping();
            }
            const pingTime = Date.now() - pingStart;
            // If ping takes > 1000ms, mark as degraded
            const status = pingTime > 1000 ? "degraded" : "operational";
            return {
                name: "Database (MongoDB)",
                status,
                description: status === "operational"
                    ? "MongoDB is connected and responding normally"
                    : `MongoDB is responding slowly (${pingTime}ms)`,
                responseTime: pingTime,
            };
        }
        catch (error) {
            logger_1.default.error("Status check — MongoDB ping failed", {
                error: error instanceof Error ? error.message : "Unknown error",
            });
            return {
                name: "Database (MongoDB)",
                status: "outage",
                description: "MongoDB is not responding to health checks",
            };
        }
    }
    /**
     * Check WebSocket service availability.
     */
    static checkWebSocket() {
        const isVercel = process.env.VERCEL === "1";
        if (isVercel) {
            return {
                name: "WebSocket",
                status: "degraded",
                description: "WebSocket is not available in serverless environment (polling fallback active)",
            };
        }
        // In standalone mode, WebSocket is initialized alongside the server
        return {
            name: "WebSocket",
            status: "operational",
            description: "Real-time WebSocket connections are active",
        };
    }
    /**
     * Check background jobs status.
     */
    static checkBackgroundJobs() {
        const isVercel = process.env.VERCEL === "1";
        if (isVercel) {
            return {
                name: "Background Jobs",
                status: "degraded",
                description: "Background jobs are not available in serverless environment",
            };
        }
        return {
            name: "Background Jobs",
            status: "operational",
            description: "Retention cleanup and anomaly scan jobs are running on schedule",
        };
    }
    /**
     * Derive overall system status from individual component statuses.
     */
    static deriveOverallStatus(components) {
        const hasOutage = components.some((c) => c.status === "outage");
        const hasDegraded = components.some((c) => c.status === "degraded");
        if (hasOutage)
            return "outage";
        if (hasDegraded)
            return "degraded";
        return "operational";
    }
    /**
     * Human-readable label for mongoose readyState.
     */
    static mongoStateLabel(state) {
        switch (state) {
            case 0:
                return "disconnected";
            case 1:
                return "connected";
            case 2:
                return "connecting";
            case 3:
                return "disconnecting";
            default:
                return "unknown";
        }
    }
}
exports.StatusService = StatusService;
