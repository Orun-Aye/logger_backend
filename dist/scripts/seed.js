"use strict";
/**
 * Database Seed Script — Full Model Coverage
 *
 * Creates a project for the first user found in the database, then populates
 * every single model with realistic, fully-populated documents so that every
 * dashboard page, settings page, and analytics view has data to display.
 *
 * Models seeded (14 total):
 *   User (found), Project (created), Log, AlertRule, AlertEvent,
 *   EscalationPolicy, Notification, UserPreference, CustomDashboard,
 *   SavedSearch, Anomaly, MaintenanceWindow, SourceMap, SDKConfig
 *
 * Usage:
 *   npx tsx src/scripts/seed.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const log_model_1 = require("../models/log.model");
const project_model_1 = require("../models/project.model");
const user_model_1 = require("../models/user.model");
const alertRule_model_1 = require("../models/alertRule.model");
const alertEvent_model_1 = require("../models/alertEvent.model");
const escalationPolicy_model_1 = require("../models/escalationPolicy.model");
const notification_model_1 = __importDefault(require("../models/notification.model"));
const userPreference_model_1 = require("../models/userPreference.model");
const customDashboard_model_1 = require("../models/customDashboard.model");
const savedSearch_model_1 = require("../models/savedSearch.model");
const anomaly_model_1 = require("../models/anomaly.model");
const maintenanceWindow_model_1 = require("../models/maintenanceWindow.model");
const sourceMap_model_1 = require("../models/sourceMap.model");
const sdk_config_model_1 = require("../models/sdk-config.model");
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI ||
    "mongodb+srv://femiadmin:betterbegood@cluster0.wq4k96o.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DAYS_BACK = 30;
const NOW = Date.now();
const PROJECT_NAME = `Apperio Demo — ${new Date().toISOString().slice(0, 10)}`;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}
function randomInt(min, max) {
    return Math.floor(randomBetween(min, max));
}
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function pickWeighted(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0)
            return items[i];
    }
    return items[items.length - 1];
}
function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}
function randomIso(minAgeMs, maxAgeMs) {
    return new Date(NOW - randomBetween(minAgeMs, maxAgeMs)).toISOString();
}
function timeInWindow(dayIndex, totalDays) {
    const dayMs = 86_400_000;
    const baseTs = NOW - (totalDays - dayIndex) * dayMs;
    return new Date(baseTs + randomBetween(0, dayMs)).toISOString();
}
function randomApiKey() {
    return `mk_${uuid().replace(/-/g, "")}${uuid().replace(/-/g, "").slice(0, 16)}`;
}
function daysAgo(d) {
    return new Date(NOW - d * 86_400_000);
}
function hoursAgo(h) {
    return new Date(NOW - h * 3_600_000);
}
function minutesAgo(m) {
    return new Date(NOW - m * 60_000);
}
// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------
const SERVICES = [
    "api-gateway",
    "auth-service",
    "user-service",
    "payment-service",
    "notification-service",
    "search-service",
    "analytics-worker",
];
const ENVIRONMENTS = ["production", "staging", "development"];
const ENV_WEIGHTS = [0.6, 0.25, 0.15];
const BROWSERS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/537.36 Safari/17.2",
    "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15",
    "Mozilla/5.0 (iPad; CPU OS 17_3 like Mac OS X) AppleWebKit/605.1.15",
];
const RELEASES = ["v1.0.0", "v1.1.0", "v1.2.0", "v1.2.1", "v1.2.2"];
const PAGES = [
    { url: "https://app.apperio.dev/dashboard", title: "Dashboard — Apperio" },
    { url: "https://app.apperio.dev/projects", title: "Projects — Apperio" },
    { url: "https://app.apperio.dev/settings", title: "Settings — Apperio" },
    { url: "https://app.apperio.dev/alerts", title: "Alerts — Apperio" },
    { url: "https://app.apperio.dev/logs", title: "Log Explorer — Apperio" },
    { url: "https://app.apperio.dev/login", title: "Login — Apperio" },
    { url: "https://app.apperio.dev/signup", title: "Sign Up — Apperio" },
    { url: "https://app.apperio.dev/projects/abc123", title: "My App — Apperio" },
    { url: "https://app.apperio.dev/projects/abc123/errors", title: "Errors — My App" },
    { url: "https://app.apperio.dev/pricing", title: "Pricing — Apperio" },
];
const REFERRERS = [
    "https://google.com/search?q=apperio+logging",
    "https://github.com/Stanwukong/remote-logger",
    "https://twitter.com/apperio_dev",
    "https://dev.to/apperio",
    "",
    "",
];
const API_ENDPOINTS = [
    { url: "/api/v1/projects", method: "GET" },
    { url: "/api/v1/projects/abc123/logs", method: "GET" },
    { url: "/api/v1/projects/abc123/logs", method: "POST" },
    { url: "/api/v1/users/login", method: "POST" },
    { url: "/api/v1/users/signup", method: "POST" },
    { url: "/api/v1/users/profile", method: "GET" },
    { url: "/api/v1/dashboard/overview", method: "GET" },
    { url: "/api/v1/dashboard/metrics", method: "GET" },
    { url: "/api/v1/alerts", method: "GET" },
    { url: "/api/v1/alert-rules", method: "POST" },
    { url: "/api/v1/projects/abc123/logs/summary", method: "GET" },
    { url: "/api/v1/insights/abc123", method: "GET" },
    { url: "https://cdn.apperio.dev/assets/app.js", method: "GET" },
    { url: "https://cdn.apperio.dev/assets/styles.css", method: "GET" },
    { url: "https://fonts.googleapis.com/css2?family=DM+Sans", method: "GET" },
];
const ERROR_MESSAGES = [
    { name: "TypeError", message: "Cannot read properties of undefined (reading 'map')" },
    { name: "ReferenceError", message: "fetchData is not defined" },
    { name: "SyntaxError", message: "Unexpected token '<' at position 0" },
    { name: "NetworkError", message: "Failed to fetch: net::ERR_CONNECTION_REFUSED" },
    { name: "TypeError", message: "null is not an object (evaluating 'user.name')" },
    { name: "RangeError", message: "Maximum call stack size exceeded" },
    { name: "Error", message: "Request failed with status code 500" },
    { name: "TypeError", message: "Cannot read properties of null (reading 'length')" },
    { name: "Error", message: "CORS policy: No 'Access-Control-Allow-Origin' header" },
    { name: "ChunkLoadError", message: "Loading chunk 12 failed (error: https://app.apperio.dev/chunk-12.js)" },
];
const CLICK_TARGETS = [
    "button.btn-primary", "a.nav-link", "div.card-header", "button#submit-form",
    "a[href='/dashboard']", "button.delete-btn", "input.search-field",
    "div.dropdown-trigger", "span.tag-close", "button.toggle-sidebar",
    "a.breadcrumb-link", "td.table-cell", "button.pagination-next",
];
const CONSOLE_MESSAGES = [
    { level: "info", args: ["[Router] Navigation to /dashboard completed in 245ms"] },
    { level: "warn", args: ["[Deprecation] componentWillMount has been renamed"] },
    { level: "error", args: ["[API] POST /api/v1/logs failed:", "500 Internal Server Error"] },
    { level: "debug", args: ["[WebSocket] Connection established, readyState: 1"] },
    { level: "warn", args: ["[Performance] Long task detected: 312ms on /projects"] },
    { level: "info", args: ["[Auth] Token refreshed successfully"] },
    { level: "error", args: ["[Uncaught] Uncaught promise rejection: NetworkError"] },
    { level: "warn", args: ["[Cache] Evicting 47 stale entries from query cache"] },
    { level: "debug", args: ["[Store] State update: selectedTimeRange -> '24h'"] },
    { level: "info", args: ["[SDK] Apperio initialized, version 1.2.2"] },
    { level: "error", args: ["[MongoDB] Query timeout after 30000ms on logs collection"] },
    { level: "warn", args: ["[Rate Limit] 85/100 requests used in current window"] },
];
const PERFORMANCE_ENTRIES = [
    { name: "navigation", type: "navigation", duration: () => randomBetween(800, 3500), size: 0 },
    { name: "first-paint", type: "paint", duration: () => randomBetween(200, 1500), size: 0 },
    { name: "first-contentful-paint", type: "paint", duration: () => randomBetween(400, 2500), size: 0 },
    { name: "https://cdn.apperio.dev/app.js", type: "resource", duration: () => randomBetween(50, 800), size: () => randomInt(50000, 350000) },
    { name: "https://cdn.apperio.dev/vendor.js", type: "resource", duration: () => randomBetween(80, 1200), size: () => randomInt(100000, 500000) },
    { name: "https://cdn.apperio.dev/styles.css", type: "resource", duration: () => randomBetween(30, 400), size: () => randomInt(10000, 80000) },
    { name: "https://fonts.gstatic.com/s/dmsans/v1/font.woff2", type: "resource", duration: () => randomBetween(40, 300), size: () => randomInt(20000, 60000) },
];
const WEB_VITALS = [
    { name: "LCP", value: () => randomBetween(800, 5000), ratingFn: (v) => (v < 2500 ? "good" : v < 4000 ? "needs-improvement" : "poor") },
    { name: "CLS", value: () => randomBetween(0, 0.5), ratingFn: (v) => (v < 0.1 ? "good" : v < 0.25 ? "needs-improvement" : "poor") },
    { name: "INP", value: () => randomBetween(50, 800), ratingFn: (v) => (v < 200 ? "good" : v < 500 ? "needs-improvement" : "poor") },
    { name: "FCP", value: () => randomBetween(400, 3500), ratingFn: (v) => (v < 1800 ? "good" : v < 3000 ? "needs-improvement" : "poor") },
    { name: "TTFB", value: () => randomBetween(100, 1500), ratingFn: (v) => (v < 800 ? "good" : v < 1800 ? "needs-improvement" : "poor") },
];
// ---------------------------------------------------------------------------
// Log generators (one per event type)
// ---------------------------------------------------------------------------
function makeErrorLog(projectId, ts, sessionId) {
    const err = pick(ERROR_MESSAGES);
    const page = pick(PAGES);
    return {
        projectId, timestamp: ts,
        level: pickWeighted(["error", "fatal"], [0.85, 0.15]),
        message: `${err.name}: ${err.message}`,
        eventType: "error",
        service: pick(SERVICES),
        environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
        userAgent: pick(BROWSERS),
        url: page.url,
        sessionId,
        release: pick(RELEASES),
        correlationId: uuid(),
        context: { sessionId, userId: `user-${randomInt(1, 50)}` },
        error: {
            name: err.name, message: err.message,
            stack: `${err.name}: ${err.message}\n    at Object.<anonymous> (app.js:${randomInt(10, 500)}:${randomInt(1, 40)})\n    at Module._compile (internal/modules/cjs/loader.js:1085:14)\n    at processTicksAndRejections (internal/process/task_queues.js:95:5)`,
            url: page.url, lineNumber: randomInt(10, 500), columnNumber: randomInt(1, 40),
        },
        data: {
            eventType: "error",
            error: {
                name: err.name, message: err.message,
                stack: `${err.name}: ${err.message}\n    at render (components/Dashboard.tsx:${randomInt(10, 200)}:${randomInt(1, 30)})`,
                url: page.url, lineNumber: randomInt(10, 500), columnNumber: randomInt(1, 40),
            },
        },
    };
}
function makeNetworkLog(projectId, ts, sessionId) {
    const endpoint = pick(API_ENDPOINTS);
    const isCdn = endpoint.url.startsWith("http");
    const duration = isCdn ? randomBetween(20, 600) : randomBetween(50, 2000);
    const isError = Math.random() < 0.12;
    const status = isError
        ? pick([400, 401, 403, 404, 500, 502, 503])
        : isCdn ? 200 : pick([200, 200, 200, 201, 204, 301]);
    return {
        projectId, timestamp: ts,
        level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        message: `${endpoint.method} ${endpoint.url} ${status}`,
        eventType: "network",
        service: pick(SERVICES),
        environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
        userAgent: pick(BROWSERS),
        url: pick(PAGES).url,
        sessionId,
        release: pick(RELEASES),
        correlationId: uuid(),
        context: { sessionId, userId: `user-${randomInt(1, 50)}` },
        data: {
            eventType: "network",
            network: {
                url: endpoint.url, method: endpoint.method,
                status, duration: Math.round(duration),
                timestamp: Date.parse(ts),
            },
        },
    };
}
function makePerformanceLog(projectId, ts, sessionId) {
    const entry = pick(PERFORMANCE_ENTRIES);
    const dur = entry.duration();
    const size = typeof entry.size === "function" ? entry.size() : entry.size;
    return {
        projectId, timestamp: ts,
        level: "info",
        message: `Performance: ${entry.name} (${entry.type}) ${Math.round(dur)}ms`,
        eventType: "performance",
        service: pick(SERVICES),
        environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
        userAgent: pick(BROWSERS),
        url: pick(PAGES).url,
        sessionId,
        release: pick(RELEASES),
        context: { sessionId, userId: `user-${randomInt(1, 50)}` },
        data: {
            eventType: "performance",
            performance: {
                name: entry.name, type: entry.type,
                startTime: randomBetween(0, 500),
                duration: Math.round(dur * 100) / 100,
                size,
            },
        },
    };
}
function makeWebVitalLog(projectId, ts, sessionId) {
    const vital = pick(WEB_VITALS);
    const value = vital.value();
    const rating = vital.ratingFn(value);
    return {
        projectId, timestamp: ts,
        level: rating === "poor" ? "warn" : "info",
        message: `Web Vital: ${vital.name} = ${value.toFixed(2)} (${rating})`,
        eventType: "web-vital",
        service: pick(SERVICES),
        environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
        userAgent: pick(BROWSERS),
        url: pick(PAGES).url,
        sessionId,
        release: pick(RELEASES),
        context: { sessionId, userId: `user-${randomInt(1, 50)}` },
        data: {
            eventType: "web-vital",
            vital: { name: vital.name, value: Math.round(value * 100) / 100, rating },
        },
    };
}
function makeInteractionLog(projectId, ts, sessionId) {
    const type = pickWeighted(["click", "scroll", "keypress", "focus", "blur"], [0.45, 0.2, 0.15, 0.1, 0.1]);
    const target = pick(CLICK_TARGETS);
    const page = pick(PAGES);
    return {
        projectId, timestamp: ts,
        level: "info",
        message: `Interaction: ${type} on ${target}`,
        eventType: "interaction",
        service: pick(SERVICES),
        environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
        userAgent: pick(BROWSERS),
        url: page.url,
        sessionId,
        release: pick(RELEASES),
        context: { sessionId, userId: `user-${randomInt(1, 50)}` },
        data: {
            eventType: "interaction",
            interaction: {
                type, target, timestamp: Date.parse(ts),
                ...(type === "click" ? { coordinates: { x: randomInt(0, 1920), y: randomInt(0, 1080) } } : {}),
            },
        },
    };
}
function makeConsoleLog(projectId, ts, sessionId) {
    const entry = pick(CONSOLE_MESSAGES);
    return {
        projectId, timestamp: ts,
        level: entry.level,
        message: entry.args.join(" "),
        eventType: "console",
        service: pick(SERVICES),
        environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
        userAgent: pick(BROWSERS),
        url: pick(PAGES).url,
        sessionId,
        release: pick(RELEASES),
        context: { sessionId, userId: `user-${randomInt(1, 50)}` },
        data: { eventType: "console", consoleArgs: entry.args },
    };
}
function makePageviewLog(projectId, ts, sessionId) {
    const page = pick(PAGES);
    const referrer = pick(REFERRERS);
    return {
        projectId, timestamp: ts,
        level: "info",
        message: `Pageview: ${page.url}`,
        eventType: "pageview",
        service: pick(SERVICES),
        environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
        userAgent: pick(BROWSERS),
        url: page.url,
        referrer,
        sessionId,
        release: pick(RELEASES),
        context: { sessionId, userId: `user-${randomInt(1, 50)}` },
        data: { eventType: "pageview", url: page.url, referrer, title: page.title },
    };
}
function makeGenericLog(projectId, ts, sessionId) {
    const messages = [
        "User authentication successful",
        "Database query executed in 12ms",
        "Cache miss for key: dashboard_overview",
        "Rate limit check passed: 42/100",
        "WebSocket connection established",
        "Project settings updated",
        "Log ingestion batch processed: 10 entries",
        "Email notification queued",
        "API key validated for project abc123",
        "Health check: all components healthy",
        "Session started",
        "Background job completed: retention cleanup",
    ];
    return {
        projectId, timestamp: ts,
        level: pickWeighted(["info", "debug", "warn", "trace"], [0.5, 0.25, 0.15, 0.1]),
        message: pick(messages),
        service: pick(SERVICES),
        environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
        userAgent: pick(BROWSERS),
        url: pick(PAGES).url,
        sessionId,
        release: pick(RELEASES),
        correlationId: uuid(),
        context: { sessionId, userId: `user-${randomInt(1, 50)}` },
        metadata: { buildNumber: randomInt(100, 999), region: pick(["us-east-1", "eu-west-1", "ap-south-1"]) },
    };
}
// ---------------------------------------------------------------------------
// Trace generator
// ---------------------------------------------------------------------------
function makeTraceGroup(projectId, dayIndex) {
    const traceId = uuid();
    const baseTs = NOW - (DAYS_BACK - dayIndex) * 86_400_000 + randomBetween(0, 86_400_000);
    const sessionId = `sess-${uuid().slice(0, 8)}`;
    const spanNames = [
        "HTTP GET /api/v1/dashboard/overview",
        "auth.verifyToken",
        "db.query logs",
        "cache.get dashboard_overview",
        "analytics.computeMetrics",
    ];
    const logs = [];
    let currentTime = baseTs;
    spanNames.forEach((name, i) => {
        const spanId = uuid().slice(0, 16);
        const parentSpanId = i === 0 ? undefined : logs[i - 1].spanId;
        const duration = randomBetween(5, 500);
        const hasError = i === 2 && Math.random() < 0.15;
        logs.push({
            projectId, timestamp: new Date(currentTime).toISOString(),
            level: hasError ? "error" : "info",
            message: name,
            service: pick(SERVICES),
            environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
            traceId, spanId, sessionId,
            release: pick(RELEASES),
            context: { sessionId, userId: `user-${randomInt(1, 50)}` },
            data: {
                span: {
                    name,
                    startTime: new Date(currentTime).toISOString(),
                    endTime: new Date(currentTime + duration).toISOString(),
                    duration, parentSpanId,
                },
            },
            ...(hasError ? {
                error: { name: "QueryTimeoutError", message: "Query execution exceeded 30000ms timeout" },
            } : {}),
        });
        currentTime += duration + randomBetween(1, 20);
    });
    return logs;
}
// ---------------------------------------------------------------------------
// Model-specific generators
// ---------------------------------------------------------------------------
function makeAlertRules(projectId, userId, escalationPolicyId) {
    return [
        {
            projectId, name: "High Error Rate",
            description: "Triggers when error count exceeds 50 in 10 minutes across any service",
            condition: { level: "error", frequency: 50, intervalMinutes: 10 },
            isActive: true,
            notifyChannels: ["email", "slack"],
            notificationConfig: {
                email: "dev-team@apperio.dev",
                slackWebhook: "https://hooks.slack.com/services/T00000/B00000/xxx",
                slackChannel: "#alerts-critical",
            },
            escalationPolicyId,
            createdBy: userId,
        },
        {
            projectId, name: "Fatal Error — Immediate",
            description: "Any fatal-level error triggers immediate notification to on-call",
            condition: { level: "fatal", frequency: 1, intervalMinutes: 1 },
            isActive: true,
            notifyChannels: ["email", "slack", "webhook"],
            notificationConfig: {
                email: "oncall@apperio.dev",
                webhookUrl: "https://pagerduty.com/webhook/apperio",
            },
            escalationPolicyId,
            createdBy: userId,
        },
        {
            projectId, name: "Slow API Response",
            description: "Alert when any endpoint exceeds 3s response time threshold",
            condition: { responseTimeThreshold: 3000, intervalMinutes: 5, service: "api-gateway" },
            isActive: true,
            notifyChannels: ["email"],
            notificationConfig: { email: "perf@apperio.dev" },
            createdBy: userId,
        },
        {
            projectId, name: "Payment Service Errors",
            description: "Critical — payment processing failures need immediate attention",
            condition: { level: "error", service: "payment-service", frequency: 3, intervalMinutes: 5 },
            isActive: true,
            notifyChannels: ["email", "webhook"],
            notificationConfig: {
                email: "billing@apperio.dev",
                webhookUrl: "https://api.opsgenie.com/v1/json/apperio",
            },
            escalationPolicyId,
            createdBy: userId,
        },
        {
            projectId, name: "Composite — Staging Health",
            description: "Composite rule: high warnings OR error spike in staging environment",
            condition: {
                operator: "OR",
                conditions: [
                    { level: "warn", environment: "staging", frequency: 100, intervalMinutes: 30 },
                    { level: "error", environment: "staging", frequency: 20, intervalMinutes: 10 },
                ],
                frequency: 1,
                intervalMinutes: 30,
            },
            isActive: true,
            notifyChannels: ["slack"],
            notificationConfig: { slackChannel: "#staging-alerts" },
            createdBy: userId,
        },
        {
            projectId, name: "Network Failure Spike",
            description: "Detects burst of 5xx responses from any service",
            condition: { level: "error", eventType: "network", keyword: "500", frequency: 10, intervalMinutes: 5 },
            isActive: true,
            notifyChannels: ["email", "slack"],
            notificationConfig: { email: "infra@apperio.dev" },
            createdBy: userId,
        },
        {
            projectId, name: "Snoozed — Console Noise",
            description: "Console error volume (snoozed until investigation completes)",
            condition: { level: "error", eventType: "console", frequency: 50, intervalMinutes: 15 },
            isActive: true,
            notifyChannels: ["email"],
            notificationConfig: { email: "dev@apperio.dev" },
            snoozeUntil: new Date(NOW + 7 * 86_400_000), // snoozed for 7 more days
            createdBy: userId,
        },
    ];
}
function makeAlertEvents(projectId, ruleIds, userId, logIds, count) {
    const events = [];
    for (let i = 0; i < count; i++) {
        const triggeredAt = new Date(NOW - randomBetween(0, DAYS_BACK * 86_400_000));
        const status = pickWeighted(["active", "acknowledged", "resolved", "snoozed"], [0.3, 0.2, 0.35, 0.15]);
        const severity = pickWeighted(["critical", "warning", "info"], [0.25, 0.5, 0.25]);
        const event = {
            projectId,
            ruleId: pick(ruleIds),
            logId: pick(logIds),
            title: pick([
                "Error rate exceeded threshold",
                "Fatal error in production",
                "Slow API response detected",
                "Payment processing error",
                "Database connection timeout",
                "High memory usage detected",
                "Unusual traffic spike",
                "5xx response rate elevated",
                "Console error flood detected",
            ]),
            message: pick([
                "Error count reached 52 in the last 10 minutes (threshold: 50)",
                "Fatal: Maximum call stack size exceeded in auth-service",
                "GET /api/v1/dashboard/overview responded in 4200ms (threshold: 3000ms)",
                "Payment service returned 5 errors in 3 minutes",
                "MongoDB query timeout after 30s on logs collection",
                "3 consecutive 502 responses from api-gateway in staging",
            ]),
            severity, status,
            notifyChannels: pick([["email"], ["email", "slack"], ["email", "slack", "webhook"]]),
            environment: pickWeighted(ENVIRONMENTS, ENV_WEIGHTS),
            service: pick(SERVICES),
            tags: [pick(["backend", "frontend", "database", "network", "infra"]), pick(["p1", "p2", "p3"])],
            metadata: {
                triggerCount: randomInt(1, 10),
                lastEndpoint: pick(API_ENDPOINTS).url,
                affectedUsers: randomInt(1, 200),
            },
            triggeredAt,
            occurenceCount: randomInt(1, 25),
            escalationLevel: status === "active" ? randomInt(0, 3) : 0,
            lastEscalatedAt: status === "active" && Math.random() > 0.5 ? new Date(triggeredAt.getTime() + randomBetween(300_000, 1_800_000)) : undefined,
        };
        if (status === "acknowledged" || status === "resolved") {
            event.acknowledgedAt = new Date(triggeredAt.getTime() + randomBetween(60_000, 1_800_000));
            event.acknowledgedBy = userId;
        }
        if (status === "resolved") {
            event.resolvedAt = new Date(triggeredAt.getTime() + randomBetween(600_000, 7_200_000));
            event.resolvedBy = userId;
            event.resolutionNotes = pick([
                "Deployed hotfix v1.2.3",
                "Increased database pool size from 10 to 25",
                "Root cause: memory leak in auth-service, patched in commit abc123",
                "False positive — traffic spike from crawler bot",
                "Rolled back deployment v1.2.1 → v1.2.0",
                "Added circuit breaker to payment-service",
            ]);
        }
        if (status === "snoozed") {
            event.snoozedUntil = new Date(NOW + randomBetween(3_600_000, 86_400_000));
            event.snoozedBy = userId;
        }
        events.push(event);
    }
    return events;
}
function makeEscalationPolicies(projectId, userId) {
    return [
        {
            projectId,
            name: "Critical Incident Response",
            description: "3-tier escalation for critical production incidents. Level 1: on-call dev, Level 2: team lead + Slack, Level 3: engineering manager + PagerDuty",
            levels: [
                {
                    level: 1, delayMinutes: 0,
                    notifyChannels: ["email"],
                    recipients: ["oncall@apperio.dev", "dev-lead@apperio.dev"],
                },
                {
                    level: 2, delayMinutes: 15,
                    notifyChannels: ["email", "slack"],
                    recipients: ["team-lead@apperio.dev", "oncall@apperio.dev"],
                },
                {
                    level: 3, delayMinutes: 30,
                    notifyChannels: ["email", "slack", "webhook"],
                    recipients: ["eng-manager@apperio.dev", "cto@apperio.dev"],
                    webhookUrl: "https://events.pagerduty.com/integration/apperio/enqueue",
                },
            ],
            isActive: true,
            createdBy: userId,
        },
        {
            projectId,
            name: "Business Hours Only",
            description: "Standard escalation for non-critical issues during business hours",
            levels: [
                {
                    level: 1, delayMinutes: 0,
                    notifyChannels: ["email"],
                    recipients: ["dev-team@apperio.dev"],
                },
                {
                    level: 2, delayMinutes: 60,
                    notifyChannels: ["email", "slack"],
                    recipients: ["team-lead@apperio.dev"],
                },
            ],
            isActive: true,
            createdBy: userId,
        },
        {
            projectId,
            name: "Payment Incidents (Archived)",
            description: "Legacy escalation path for payment-related alerts — replaced by Critical Incident Response",
            levels: [
                {
                    level: 1, delayMinutes: 0,
                    notifyChannels: ["email", "webhook"],
                    recipients: ["billing@apperio.dev"],
                    webhookUrl: "https://api.opsgenie.com/v1/json/apperio-billing",
                },
            ],
            isActive: false,
            createdBy: userId,
        },
    ];
}
function makeNotifications(userId) {
    return [
        {
            userId, type: "success",
            message: "Project \"Apperio Demo\" created successfully",
            read: true,
            metadata: { action: "project_created", projectName: PROJECT_NAME },
            createdAt: daysAgo(25),
        },
        {
            userId, type: "info",
            message: "Your API key has been regenerated. Update your SDK configuration.",
            read: true,
            metadata: { action: "api_key_regenerated" },
            createdAt: daysAgo(20),
        },
        {
            userId, type: "warning",
            message: "Error rate in production exceeded 5% in the last hour",
            read: true,
            metadata: { action: "threshold_warning", errorRate: 5.3, environment: "production" },
            createdAt: daysAgo(14),
        },
        {
            userId, type: "error",
            message: "Alert rule \"High Error Rate\" triggered 3 times in the last 24 hours",
            read: false,
            metadata: { action: "alert_triggered", ruleId: "rule-1", count: 3 },
            createdAt: daysAgo(3),
        },
        {
            userId, type: "info",
            message: "Maintenance window \"Database Migration v1.2\" completed successfully",
            read: false,
            metadata: { action: "maintenance_completed", windowName: "Database Migration v1.2" },
            createdAt: daysAgo(2),
        },
        {
            userId, type: "warning",
            message: "Log retention cleanup removed 12,847 logs older than 30 days",
            read: false,
            metadata: { action: "retention_cleanup", logsRemoved: 12847, retentionDays: 30 },
            createdAt: daysAgo(1),
        },
        {
            userId, type: "success",
            message: "SDK config updated — auto-capture for user interactions enabled",
            read: false,
            metadata: { action: "sdk_config_updated", field: "autoCapture.userInteractions" },
            createdAt: hoursAgo(6),
        },
        {
            userId, type: "error",
            message: "Webhook delivery failed for endpoint https://hooks.slack.com/xxx — 502 Bad Gateway",
            read: false,
            metadata: { action: "webhook_failure", endpoint: "https://hooks.slack.com/xxx", status: 502 },
            createdAt: hoursAgo(2),
        },
    ];
}
function makeCustomDashboards(userId, projectIdStr) {
    return [
        {
            userId,
            name: "Production Overview",
            description: "Real-time production health metrics with error tracking, performance, and network status",
            isDefault: true,
            isShared: true,
            tags: ["production", "overview", "shared"],
            widgets: [
                {
                    id: "w-1", type: "counter", title: "Total Errors (24h)",
                    config: { metric: "error-count", projectId: projectIdStr, timeRange: "24h", eventType: "error" },
                    layout: { x: 0, y: 0, w: 3, h: 2 },
                },
                {
                    id: "w-2", type: "counter", title: "Error Rate",
                    config: { metric: "error-rate", projectId: projectIdStr, timeRange: "24h" },
                    layout: { x: 3, y: 0, w: 3, h: 2 },
                },
                {
                    id: "w-3", type: "gauge", title: "Health Score",
                    config: { metric: "health-score", projectId: projectIdStr, timeRange: "1h" },
                    layout: { x: 6, y: 0, w: 3, h: 2 },
                },
                {
                    id: "w-4", type: "counter", title: "Active Alerts",
                    config: { metric: "active-alerts", projectId: projectIdStr, timeRange: "24h" },
                    layout: { x: 9, y: 0, w: 3, h: 2 },
                },
                {
                    id: "w-5", type: "chart", title: "Log Volume Timeline",
                    config: { metric: "log-volume", projectId: projectIdStr, timeRange: "24h", chartType: "area", refreshInterval: 60000 },
                    layout: { x: 0, y: 2, w: 8, h: 4 },
                },
                {
                    id: "w-6", type: "alert-list", title: "Recent Alerts",
                    config: { projectId: projectIdStr, timeRange: "24h" },
                    layout: { x: 8, y: 2, w: 4, h: 4 },
                },
                {
                    id: "w-7", type: "chart", title: "Error Breakdown by Service",
                    config: { metric: "error-count", projectId: projectIdStr, timeRange: "7d", chartType: "bar" },
                    layout: { x: 0, y: 6, w: 6, h: 3 },
                },
                {
                    id: "w-8", type: "sparkline", title: "Network Requests",
                    config: { metric: "network-requests", projectId: projectIdStr, timeRange: "24h", eventType: "network" },
                    layout: { x: 6, y: 6, w: 6, h: 3 },
                },
            ],
        },
        {
            userId,
            name: "Performance & Web Vitals",
            description: "Core Web Vitals monitoring with LCP, CLS, INP, FCP, and TTFB tracking",
            isDefault: false,
            isShared: true,
            tags: ["performance", "web-vitals"],
            widgets: [
                {
                    id: "w-p1", type: "counter", title: "LCP (p75)",
                    config: { metric: "perf-lcp", projectId: projectIdStr, timeRange: "24h", eventType: "web-vital" },
                    layout: { x: 0, y: 0, w: 4, h: 2 },
                },
                {
                    id: "w-p2", type: "counter", title: "CLS (p75)",
                    config: { metric: "perf-cls", projectId: projectIdStr, timeRange: "24h", eventType: "web-vital" },
                    layout: { x: 4, y: 0, w: 4, h: 2 },
                },
                {
                    id: "w-p3", type: "counter", title: "INP (p75)",
                    config: { metric: "perf-inp", projectId: projectIdStr, timeRange: "24h", eventType: "web-vital" },
                    layout: { x: 8, y: 0, w: 4, h: 2 },
                },
                {
                    id: "w-p4", type: "chart", title: "Web Vitals Over Time",
                    config: { metric: "perf-lcp", projectId: projectIdStr, timeRange: "7d", chartType: "line" },
                    layout: { x: 0, y: 2, w: 12, h: 4 },
                },
                {
                    id: "w-p5", type: "table", title: "Slowest Endpoints",
                    config: { metric: "network-avg-duration", projectId: projectIdStr, timeRange: "24h", eventType: "network" },
                    layout: { x: 0, y: 6, w: 6, h: 3 },
                },
                {
                    id: "w-p6", type: "heatmap", title: "Response Time Heatmap",
                    config: { metric: "network-p95-duration", projectId: projectIdStr, timeRange: "7d", eventType: "network" },
                    layout: { x: 6, y: 6, w: 6, h: 3 },
                },
            ],
        },
        {
            userId,
            name: "User Behavior",
            description: "User interactions, pageviews, and console activity analysis",
            isDefault: false,
            isShared: false,
            tags: ["user-behavior", "interactions", "pageviews"],
            widgets: [
                {
                    id: "w-u1", type: "counter", title: "Total Interactions",
                    config: { metric: "interaction-total", projectId: projectIdStr, timeRange: "24h", eventType: "interaction" },
                    layout: { x: 0, y: 0, w: 3, h: 2 },
                },
                {
                    id: "w-u2", type: "counter", title: "Clicks",
                    config: { metric: "interaction-clicks", projectId: projectIdStr, timeRange: "24h", eventType: "interaction" },
                    layout: { x: 3, y: 0, w: 3, h: 2 },
                },
                {
                    id: "w-u3", type: "counter", title: "Pageviews",
                    config: { metric: "pageview-total", projectId: projectIdStr, timeRange: "24h", eventType: "pageview" },
                    layout: { x: 6, y: 0, w: 3, h: 2 },
                },
                {
                    id: "w-u4", type: "counter", title: "Console Errors",
                    config: { metric: "console-errors", projectId: projectIdStr, timeRange: "24h", eventType: "console" },
                    layout: { x: 9, y: 0, w: 3, h: 2 },
                },
                {
                    id: "w-u5", type: "chart", title: "Interaction Timeline",
                    config: { metric: "interaction-total", projectId: projectIdStr, timeRange: "7d", chartType: "area" },
                    layout: { x: 0, y: 2, w: 6, h: 4 },
                },
                {
                    id: "w-u6", type: "chart", title: "Top Pages",
                    config: { metric: "pageview-total", projectId: projectIdStr, timeRange: "7d", chartType: "bar", eventType: "pageview" },
                    layout: { x: 6, y: 2, w: 6, h: 4 },
                },
            ],
        },
    ];
}
function makeSavedSearches(projectId, userId) {
    return [
        {
            projectId, userId,
            name: "Production Errors (Last 24h)",
            description: "All error and fatal logs in production from the last 24 hours",
            filters: {
                levels: ["error", "fatal"],
                environments: ["production"],
                timeRange: { preset: "24h" },
            },
            isDefault: true,
            isShared: true,
            sortBy: "timestamp",
            sortOrder: "desc",
        },
        {
            projectId, userId,
            name: "Payment Service Activity",
            description: "All logs from the payment-service, any level or environment",
            filters: {
                services: ["payment-service"],
                timeRange: { preset: "7d" },
            },
            isDefault: false,
            isShared: true,
            sortBy: "timestamp",
            sortOrder: "desc",
        },
        {
            projectId, userId,
            name: "Network Failures",
            description: "Failed network requests (4xx and 5xx status codes)",
            filters: {
                levels: ["warn", "error"],
                eventTypes: ["network"],
                search: "500",
                timeRange: { preset: "24h" },
            },
            isDefault: false,
            isShared: false,
            sortBy: "timestamp",
            sortOrder: "desc",
        },
        {
            projectId, userId,
            name: "Slow API Responses",
            description: "Network requests taking longer than 2 seconds",
            filters: {
                eventTypes: ["network"],
                timeRange: { preset: "7d" },
                customFilters: { "data.network.duration": { $gte: 2000 } },
            },
            isDefault: false,
            isShared: true,
            sortBy: "data.network.duration",
            sortOrder: "desc",
        },
        {
            projectId, userId,
            name: "Web Vitals — Poor Scores",
            description: "Web vital measurements rated as 'poor'",
            filters: {
                eventTypes: ["web-vital"],
                search: "poor",
                timeRange: { preset: "30d" },
            },
            isDefault: false,
            isShared: false,
            sortBy: "timestamp",
            sortOrder: "desc",
        },
        {
            projectId, userId,
            name: "Staging Debug Logs",
            description: "Debug and trace level logs in staging for development investigation",
            filters: {
                levels: ["debug", "trace"],
                environments: ["staging"],
                timeRange: { preset: "24h" },
            },
            isDefault: false,
            isShared: false,
            sortBy: "timestamp",
            sortOrder: "desc",
        },
    ];
}
function makeAnomalies(projectId, userId) {
    return [
        {
            projectId, type: "error_spike", severity: "critical",
            metric: "error_count",
            currentValue: 87, baselineValue: 22, deviation: 65, percentChange: 295.5,
            description: "Error count spiked to 87 (baseline: 22) — 295% increase detected in the last 30 minutes. Primarily TypeError in auth-service.",
            detectedAt: hoursAgo(3), resolvedAt: hoursAgo(1),
            acknowledged: true, acknowledgedBy: userId,
            metadata: {
                affectedServices: ["auth-service", "api-gateway"],
                topError: "TypeError: Cannot read properties of undefined (reading 'map')",
                environment: "production",
                zScore: 4.2,
            },
        },
        {
            projectId, type: "log_volume_spike", severity: "warning",
            metric: "log_volume_per_minute",
            currentValue: 340, baselineValue: 120, deviation: 220, percentChange: 183.3,
            description: "Log ingestion volume jumped to 340/min (baseline: 120/min). Possible traffic surge or logging misconfiguration.",
            detectedAt: hoursAgo(8), resolvedAt: hoursAgo(5),
            acknowledged: true, acknowledgedBy: userId,
            metadata: {
                peakMinute: hoursAgo(7).toISOString(),
                correlatedEvent: "Marketing email campaign sent at 10:00 UTC",
            },
        },
        {
            projectId, type: "response_time_degradation", severity: "warning",
            metric: "avg_response_time_ms",
            currentValue: 2800, baselineValue: 450, deviation: 2350, percentChange: 522.2,
            description: "Average response time degraded to 2.8s (baseline: 450ms) on /api/v1/dashboard/overview. Database query performance likely impacted.",
            detectedAt: hoursAgo(12), resolvedAt: null,
            acknowledged: false, acknowledgedBy: null,
            metadata: {
                endpoint: "/api/v1/dashboard/overview",
                p95: 4200, p99: 5800,
                possibleCause: "Missing index on logs collection for timestamp + projectId compound query",
            },
        },
        {
            projectId, type: "error_rate_increase", severity: "critical",
            metric: "error_rate_percent",
            currentValue: 8.7, baselineValue: 1.2, deviation: 7.5, percentChange: 625.0,
            description: "Error rate increased from 1.2% to 8.7% in production. Payment-service returning 500s after v1.2.1 deployment.",
            detectedAt: daysAgo(2), resolvedAt: daysAgo(2).getTime() + 3_600_000 > NOW ? null : new Date(daysAgo(2).getTime() + 3_600_000),
            acknowledged: true, acknowledgedBy: userId,
            metadata: {
                deploymentVersion: "v1.2.1",
                rollbackVersion: "v1.2.0",
                affectedEndpoints: ["/api/v1/payments/charge", "/api/v1/payments/refund"],
            },
        },
        {
            projectId, type: "log_volume_spike", severity: "info",
            metric: "debug_log_volume",
            currentValue: 500, baselineValue: 80, deviation: 420, percentChange: 525.0,
            description: "Debug log volume increased significantly. Likely caused by verbose logging enabled for troubleshooting.",
            detectedAt: daysAgo(5), resolvedAt: daysAgo(4),
            acknowledged: true, acknowledgedBy: userId,
            metadata: { cause: "Developer enabled DEBUG level on search-service for investigation" },
        },
        {
            projectId, type: "error_spike", severity: "warning",
            metric: "network_error_count",
            currentValue: 45, baselineValue: 8, deviation: 37, percentChange: 462.5,
            description: "Network errors spiked — 45 failed requests in 15 minutes (baseline: 8). CDN returning 502 errors.",
            detectedAt: daysAgo(7), resolvedAt: daysAgo(7),
            acknowledged: true, acknowledgedBy: userId,
            metadata: { affectedUrl: "https://cdn.apperio.dev/assets/app.js", statusCode: 502 },
        },
        {
            projectId, type: "response_time_degradation", severity: "info",
            metric: "fcp_ms",
            currentValue: 2800, baselineValue: 1200, deviation: 1600, percentChange: 133.3,
            description: "First Contentful Paint degraded to 2.8s (baseline: 1.2s). New bundle size may be impacting load times.",
            detectedAt: daysAgo(10), resolvedAt: daysAgo(9),
            acknowledged: true, acknowledgedBy: userId,
            metadata: { bundleSizeBefore: "245KB", bundleSizeAfter: "412KB", page: "/dashboard" },
        },
    ];
}
function makeMaintenanceWindows(projectId, userId) {
    return [
        {
            projectId, name: "Database Migration v1.2",
            description: "Migrating logs collection to new sharded cluster. Expect brief write delays.",
            startTime: daysAgo(14),
            endTime: new Date(daysAgo(14).getTime() + 4 * 3_600_000), // 4 hours
            reason: "Infrastructure upgrade — MongoDB shard migration",
            affectedServices: ["api-gateway", "analytics-worker"],
            affectedEnvironments: ["production"],
            suppressAllAlerts: false,
            createdBy: userId, isActive: false, // completed
        },
        {
            projectId, name: "CDN Cache Purge",
            description: "Full CDN cache invalidation after frontend deployment",
            startTime: daysAgo(7),
            endTime: new Date(daysAgo(7).getTime() + 30 * 60_000), // 30 minutes
            reason: "Frontend v1.2.2 deployment — purging stale assets",
            affectedServices: [],
            affectedEnvironments: ["production", "staging"],
            suppressAllAlerts: true,
            createdBy: userId, isActive: false,
        },
        {
            projectId, name: "Scheduled Security Patching",
            description: "OS-level security patches being applied to all nodes",
            startTime: new Date(NOW + 2 * 86_400_000), // 2 days from now
            endTime: new Date(NOW + 2 * 86_400_000 + 2 * 3_600_000), // 2 hours window
            reason: "Monthly security patch cycle — March 2026",
            affectedServices: SERVICES,
            affectedEnvironments: ["production", "staging"],
            suppressAllAlerts: true,
            createdBy: userId, isActive: true, // upcoming
        },
        {
            projectId, name: "Payment Provider Switch",
            description: "Migrating from Stripe v2 to v3 API. Payment processing will be tested in staging first.",
            startTime: new Date(NOW + 5 * 86_400_000),
            endTime: new Date(NOW + 5 * 86_400_000 + 6 * 3_600_000),
            reason: "Stripe API v2 deprecation",
            affectedServices: ["payment-service"],
            affectedEnvironments: ["staging"],
            suppressAllAlerts: false,
            createdBy: userId, isActive: true,
        },
    ];
}
function makeSourceMaps(projectId) {
    const releases = ["v1.2.0", "v1.2.1", "v1.2.2"];
    const files = [
        { fileName: "app.min.js", originalFileName: "src/app.tsx", size: 245_000 },
        { fileName: "vendor.min.js", originalFileName: "node_modules/bundle.js", size: 480_000 },
        { fileName: "styles.min.css", originalFileName: "src/styles/globals.css", size: 32_000 },
        { fileName: "dashboard.chunk.js", originalFileName: "src/pages/dashboard.tsx", size: 67_000 },
    ];
    const maps = [];
    for (const release of releases) {
        for (const file of files) {
            maps.push({
                projectId, release,
                fileName: file.fileName,
                originalFileName: file.originalFileName,
                sourceMapData: Buffer.from(JSON.stringify({
                    version: 3,
                    file: file.fileName,
                    sourceRoot: "",
                    sources: [file.originalFileName],
                    names: ["render", "useState", "useEffect", "fetchData", "handleClick", "onSubmit"],
                    mappings: "AAAA,SAAS,OAAO,GAAG,OAAO",
                })).toString("base64"),
                uploadedBy: "ci-pipeline",
                fileSize: file.size,
            });
        }
    }
    return maps;
}
function makeSDKConfig(projectId) {
    return {
        projectId,
        minLogLevel: "debug",
        batchSize: 15,
        flushIntervalMs: 3000,
        environment: "production",
        serviceName: "apperio-demo-app",
        autoCapture: {
            errors: true,
            performance: true,
            userInteractions: true,
            networkRequests: true,
            consoleMessages: true,
            pageViews: true,
        },
        sanitization: {
            enabled: true,
            strictMode: "BALANCED",
            presetConfig: {
                auditEnabled: true,
                anonymizationEnabled: false,
                sensitiveFields: ["password", "ssn", "creditCard", "apiKey", "token", "secret"],
                retentionPolicy: {
                    maxAge: 30,
                    maxSize: 10,
                    autoDelete: true,
                    archiveBeforeDelete: true,
                },
            },
            customRules: [
                {
                    pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
                    replacement: "[EMAIL_REDACTED]",
                    description: "Redact email addresses from log data",
                    severity: "high",
                    category: "pii",
                },
                {
                    pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b",
                    replacement: "[SSN_REDACTED]",
                    description: "Redact US Social Security Numbers",
                    severity: "critical",
                    category: "pii",
                },
                {
                    pattern: "Bearer\\s+[A-Za-z0-9\\-._~+/]+=*",
                    replacement: "Bearer [TOKEN_REDACTED]",
                    description: "Redact JWT Bearer tokens",
                    severity: "high",
                    category: "credentials",
                },
                {
                    pattern: "sk_live_[A-Za-z0-9]{24,}",
                    replacement: "[STRIPE_KEY_REDACTED]",
                    description: "Redact Stripe live secret keys",
                    severity: "critical",
                    category: "credentials",
                },
            ],
        },
    };
}
// ---------------------------------------------------------------------------
// Main seeder
// ---------------------------------------------------------------------------
async function seed() {
    console.log("Connecting to MongoDB...");
    await mongoose_1.default.connect(MONGODB_URI);
    console.log("Connected\n");
    // ── Find the first user ──────────────────────────────────────────────
    const user = await user_model_1.UserModel.findOne().sort({ createdAt: 1 }).lean();
    if (!user) {
        console.error("No user found in database. Sign up via the dashboard first.");
        process.exit(1);
    }
    const userId = user._id;
    console.log(`User: ${user.firstName} ${user.lastName} (${user.email})\n`);
    // ── Create a fully-populated project ─────────────────────────────────
    // Delete previous seed project if it exists (by name pattern)
    const existingProject = await project_model_1.ProjectModel.findOne({ name: { $regex: /^Apperio Demo/ } });
    if (existingProject) {
        const pid = existingProject._id;
        const pidStr = pid.toString();
        console.log(`Cleaning previous seed project "${existingProject.name}"...`);
        await Promise.all([
            log_model_1.LogModel.deleteMany({ projectId: pidStr }),
            alertRule_model_1.AlertRuleModel.deleteMany({ projectId: pid }),
            alertEvent_model_1.AlertEventModel.deleteMany({ projectId: pid }),
            escalationPolicy_model_1.EscalationPolicyModel.deleteMany({ projectId: pid }),
            notification_model_1.default.deleteMany({ userId }),
            customDashboard_model_1.CustomDashboardModel.deleteMany({ userId }),
            savedSearch_model_1.SavedSearchModel.deleteMany({ projectId: pid }),
            anomaly_model_1.AnomalyModel.deleteMany({ projectId: pidStr }),
            maintenanceWindow_model_1.MaintenanceWindowModel.deleteMany({ projectId: pid }),
            sourceMap_model_1.SourceMapModel.deleteMany({ projectId: pidStr }),
            sdk_config_model_1.SDKConfigModel.deleteMany({ projectId: pidStr }),
            userPreference_model_1.UserPreferenceModel.deleteMany({ userId }),
            project_model_1.ProjectModel.deleteOne({ _id: pid }),
        ]);
        console.log("   Cleaned.\n");
    }
    console.log(`Creating project: "${PROJECT_NAME}"...`);
    const project = await project_model_1.ProjectModel.create({
        name: PROJECT_NAME,
        description: "Full-featured demo project for Apperio observability platform. Contains realistic data across all 7 event types, distributed traces, alert rules with escalation policies, anomaly detection, maintenance windows, source maps, SDK configuration, saved searches, custom dashboards, and user notifications.",
        apiKey: randomApiKey(),
        ownerId: userId,
        teamMembers: [],
        isActive: true,
        logCount: 0,
        alertRuleCount: 0,
        integrationSettings: {
            slack: {
                enabled: true,
                webhookUrl: "https://hooks.slack.com/services/T00000/B00000/xxxxxxxxxxxx",
                channel: "#apperio-alerts",
                notifyOnCritical: true,
                notifyOnWarning: true,
                notifyOnInfo: false,
            },
            webhook: {
                enabled: true,
                url: "https://events.pagerduty.com/integration/apperio/enqueue",
                secret: "whsec_xxxxxxxxxxxxxxxxxxxx",
                retryCount: 3,
            },
            email: {
                enabled: true,
                recipients: ["dev-team@apperio.dev", "oncall@apperio.dev"],
                digestFrequency: "hourly",
            },
        },
        rateLimitConfig: {
            maxRequestsPerMinute: 200,
            burstLimit: 25,
        },
        tags: ["demo", "observability", "full-stack", "production"],
        lastIngestedAt: new Date(),
        retentionConfig: {
            retentionDays: 30,
            autoCleanupEnabled: true,
        },
        samplingConfig: {
            enabled: true,
            mode: "percentage",
            value: 100,
            alwaysKeepLevels: ["error", "fatal", "warn"],
        },
    });
    const projectId = project._id;
    const projectIdStr = projectId.toString();
    console.log(`   Created: ${projectIdStr}\n`);
    // ── Sessions ─────────────────────────────────────────────────────────
    const SESSION_COUNT = 150;
    const sessionIds = Array.from({ length: SESSION_COUNT }, () => `sess-${uuid().slice(0, 8)}`);
    // ── Generate logs ────────────────────────────────────────────────────
    console.log("Generating logs...");
    const allLogs = [];
    for (let day = 0; day < DAYS_BACK; day++) {
        const sessionSlice = sessionIds.slice((day * 5) % SESSION_COUNT, ((day * 5) % SESSION_COUNT) + randomInt(5, 12));
        const errorCount = day > DAYS_BACK - 7 ? randomInt(15, 30) : randomInt(5, 18);
        for (let i = 0; i < errorCount; i++)
            allLogs.push(makeErrorLog(projectIdStr, timeInWindow(day, DAYS_BACK), pick(sessionSlice)));
        for (let i = 0; i < randomInt(45, 80); i++)
            allLogs.push(makeNetworkLog(projectIdStr, timeInWindow(day, DAYS_BACK), pick(sessionSlice)));
        for (let i = 0; i < randomInt(15, 35); i++)
            allLogs.push(makePerformanceLog(projectIdStr, timeInWindow(day, DAYS_BACK), pick(sessionSlice)));
        for (let i = 0; i < randomInt(10, 22); i++)
            allLogs.push(makeWebVitalLog(projectIdStr, timeInWindow(day, DAYS_BACK), pick(sessionSlice)));
        for (let i = 0; i < randomInt(35, 65); i++)
            allLogs.push(makeInteractionLog(projectIdStr, timeInWindow(day, DAYS_BACK), pick(sessionSlice)));
        for (let i = 0; i < randomInt(12, 28); i++)
            allLogs.push(makeConsoleLog(projectIdStr, timeInWindow(day, DAYS_BACK), pick(sessionSlice)));
        for (let i = 0; i < randomInt(25, 45); i++)
            allLogs.push(makePageviewLog(projectIdStr, timeInWindow(day, DAYS_BACK), pick(sessionSlice)));
        for (let i = 0; i < randomInt(25, 40); i++)
            allLogs.push(makeGenericLog(projectIdStr, timeInWindow(day, DAYS_BACK), pick(sessionSlice)));
        for (let i = 0; i < randomInt(3, 8); i++)
            allLogs.push(...makeTraceGroup(projectIdStr, day));
    }
    console.log(`   Generated ${allLogs.length} logs across ${DAYS_BACK} days`);
    // Bulk insert logs
    console.log("Inserting logs...");
    const BATCH_SIZE = 2000;
    for (let i = 0; i < allLogs.length; i += BATCH_SIZE) {
        await log_model_1.LogModel.insertMany(allLogs.slice(i, i + BATCH_SIZE), { ordered: false });
        process.stdout.write(`\r   Inserted ${Math.min(i + BATCH_SIZE, allLogs.length)}/${allLogs.length}`);
    }
    console.log("\n   Logs inserted.\n");
    // Grab some log IDs for alert events
    const sampleLogs = await log_model_1.LogModel.find({ projectId: projectIdStr, level: { $in: ["error", "fatal"] } })
        .limit(50).select("_id").lean();
    const logIds = sampleLogs.map((l) => l._id);
    // Update project counts
    await project_model_1.ProjectModel.updateOne({ _id: projectId }, { $set: { logCount: allLogs.length, lastIngestedAt: new Date() } });
    // ── Escalation Policies ──────────────────────────────────────────────
    console.log("Creating escalation policies...");
    const escPolicies = makeEscalationPolicies(projectId, userId);
    const insertedPolicies = await escalationPolicy_model_1.EscalationPolicyModel.insertMany(escPolicies);
    const activePolicyId = insertedPolicies[0]._id;
    console.log(`   Created ${insertedPolicies.length} escalation policies`);
    // ── Alert Rules ──────────────────────────────────────────────────────
    console.log("Creating alert rules...");
    const rules = makeAlertRules(projectId, userId, activePolicyId);
    const insertedRules = await alertRule_model_1.AlertRuleModel.insertMany(rules);
    const ruleIds = insertedRules.map((r) => r._id);
    console.log(`   Created ${insertedRules.length} alert rules`);
    await project_model_1.ProjectModel.updateOne({ _id: projectId }, { $set: { alertRuleCount: insertedRules.length } });
    // ── Alert Events ─────────────────────────────────────────────────────
    console.log("Creating alert events...");
    const alertEvents = makeAlertEvents(projectId, ruleIds, userId, logIds, 100);
    await alertEvent_model_1.AlertEventModel.insertMany(alertEvents);
    console.log(`   Created ${alertEvents.length} alert events`);
    // ── Notifications ────────────────────────────────────────────────────
    console.log("Creating notifications...");
    const notifications = makeNotifications(userId);
    await notification_model_1.default.insertMany(notifications);
    console.log(`   Created ${notifications.length} notifications`);
    // ── User Preferences ─────────────────────────────────────────────────
    console.log("Creating user preferences...");
    await userPreference_model_1.UserPreferenceModel.findOneAndUpdate({ userId }, { userId, favoriteProjects: [projectId] }, { upsert: true, new: true });
    console.log("   Created user preferences (1 favorite project)");
    // ── Custom Dashboards ────────────────────────────────────────────────
    console.log("Creating custom dashboards...");
    const dashboards = makeCustomDashboards(userId, projectIdStr);
    const insertedDashboards = await customDashboard_model_1.CustomDashboardModel.insertMany(dashboards);
    console.log(`   Created ${insertedDashboards.length} custom dashboards (${insertedDashboards.reduce((sum, d) => sum + d.widgets.length, 0)} widgets total)`);
    // ── Saved Searches ───────────────────────────────────────────────────
    console.log("Creating saved searches...");
    const searches = makeSavedSearches(projectId, userId);
    const insertedSearches = await savedSearch_model_1.SavedSearchModel.insertMany(searches);
    console.log(`   Created ${insertedSearches.length} saved searches`);
    // ── Anomalies ────────────────────────────────────────────────────────
    console.log("Creating anomalies...");
    const anomalies = makeAnomalies(projectIdStr, userId);
    const insertedAnomalies = await anomaly_model_1.AnomalyModel.insertMany(anomalies);
    console.log(`   Created ${insertedAnomalies.length} anomalies`);
    // ── Maintenance Windows ──────────────────────────────────────────────
    console.log("Creating maintenance windows...");
    const windows = makeMaintenanceWindows(projectId, userId);
    const insertedWindows = await maintenanceWindow_model_1.MaintenanceWindowModel.insertMany(windows);
    console.log(`   Created ${insertedWindows.length} maintenance windows`);
    // ── Source Maps ──────────────────────────────────────────────────────
    console.log("Creating source maps...");
    const sourceMaps = makeSourceMaps(projectIdStr);
    const insertedMaps = await sourceMap_model_1.SourceMapModel.insertMany(sourceMaps);
    console.log(`   Created ${insertedMaps.length} source maps (${[...new Set(sourceMaps.map(s => s.release))].length} releases)`);
    // ── SDK Config ───────────────────────────────────────────────────────
    console.log("Creating SDK config...");
    const sdkConfig = makeSDKConfig(projectIdStr);
    await sdk_config_model_1.SDKConfigModel.create(sdkConfig);
    console.log("   Created SDK config (all auto-capture enabled, BALANCED sanitization, 4 custom rules)");
    // ── Summary ──────────────────────────────────────────────────────────
    const counts = {
        error: allLogs.filter((l) => l.eventType === "error").length,
        network: allLogs.filter((l) => l.eventType === "network").length,
        performance: allLogs.filter((l) => l.eventType === "performance").length,
        "web-vital": allLogs.filter((l) => l.eventType === "web-vital").length,
        interaction: allLogs.filter((l) => l.eventType === "interaction").length,
        console: allLogs.filter((l) => l.eventType === "console").length,
        pageview: allLogs.filter((l) => l.eventType === "pageview").length,
        generic: allLogs.filter((l) => !l.eventType).length,
        traces: allLogs.filter((l) => l.traceId).length,
    };
    console.log("\n" + "=".repeat(52));
    console.log("  SEED COMPLETE — Full Model Coverage");
    console.log("=".repeat(52));
    console.log(`  User:               ${user.firstName} ${user.lastName}`);
    console.log(`  Project:            ${PROJECT_NAME}`);
    console.log(`  Project ID:         ${projectIdStr}`);
    console.log("-".repeat(52));
    console.log("  LOGS");
    console.log(`    Total:            ${allLogs.length.toLocaleString()}`);
    console.log(`    Sessions:         ${SESSION_COUNT}`);
    console.log(`    Errors:           ${counts.error}`);
    console.log(`    Network:          ${counts.network}`);
    console.log(`    Performance:      ${counts.performance}`);
    console.log(`    Web Vitals:       ${counts["web-vital"]}`);
    console.log(`    Interactions:     ${counts.interaction}`);
    console.log(`    Console:          ${counts.console}`);
    console.log(`    Pageviews:        ${counts.pageview}`);
    console.log(`    Generic:          ${counts.generic}`);
    console.log(`    Trace spans:      ${counts.traces}`);
    console.log("-".repeat(52));
    console.log("  OTHER MODELS");
    console.log(`    Alert Rules:      ${insertedRules.length} (incl. composite + snoozed)`);
    console.log(`    Alert Events:     ${alertEvents.length} (all 4 statuses)`);
    console.log(`    Escalation:       ${insertedPolicies.length} policies`);
    console.log(`    Notifications:    ${notifications.length}`);
    console.log(`    Custom Dashboards:${insertedDashboards.length} (${insertedDashboards.reduce((s, d) => s + d.widgets.length, 0)} widgets)`);
    console.log(`    Saved Searches:   ${insertedSearches.length}`);
    console.log(`    Anomalies:        ${insertedAnomalies.length}`);
    console.log(`    Maint. Windows:   ${insertedWindows.length} (2 past, 2 upcoming)`);
    console.log(`    Source Maps:      ${insertedMaps.length} (3 releases x 4 files)`);
    console.log(`    SDK Config:       1 (fully populated)`);
    console.log(`    User Preferences: 1`);
    console.log("=".repeat(52));
    console.log("  All 14 models populated. Seed complete.\n");
    await mongoose_1.default.disconnect();
    process.exit(0);
}
seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
