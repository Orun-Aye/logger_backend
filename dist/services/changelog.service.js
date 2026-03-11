"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangelogService = void 0;
const changelog_model_1 = require("../models/changelog.model");
const logger_1 = __importDefault(require("../utils/logger"));
class ChangelogService {
    /**
     * Get changelog entries with pagination and optional category filter.
     */
    static async getChangelogs(params) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(50, Math.max(1, params.limit || 10));
        const skip = (page - 1) * limit;
        const filter = {};
        if (params.category &&
            ["feature", "improvement", "bugfix", "security", "performance"].includes(params.category)) {
            filter.category = params.category;
        }
        const [entries, total] = await Promise.all([
            changelog_model_1.ChangelogModel.find(filter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            changelog_model_1.ChangelogModel.countDocuments(filter),
        ]);
        return {
            entries: entries,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
    /**
     * Create a new changelog entry.
     */
    static async createChangelog(data) {
        const entry = new changelog_model_1.ChangelogModel(data);
        await entry.save();
        return entry;
    }
    /**
     * Seed initial changelog entries if the collection is empty.
     * Called during server startup.
     */
    static async seedIfEmpty() {
        try {
            const count = await changelog_model_1.ChangelogModel.countDocuments();
            if (count > 0) {
                logger_1.default.info(`Changelog collection already has ${count} entries, skipping seed`);
                return;
            }
            const seedEntries = [
                {
                    version: "1.0.0",
                    title: "Initial Release",
                    date: new Date("2025-06-01"),
                    category: "feature",
                    description: "The first public release of Apperio, a comprehensive observability platform for modern applications. Includes core logging infrastructure, error tracking, and a real-time dashboard for monitoring your services.",
                    highlights: [
                        "Core log ingestion API with project-scoped API keys",
                        "Real-time dashboard with log level distribution and trends",
                        "Error tracking with stack trace capture and grouping",
                        "JWT-based authentication and project management",
                        "MongoDB-backed storage with optimized indexes",
                    ],
                    author: "Apperio Team",
                },
                {
                    version: "1.1.0",
                    title: "Auto-Instrumentation SDK",
                    date: new Date("2025-08-15"),
                    category: "feature",
                    description: "Introduced the Apperio JavaScript SDK with automatic instrumentation. Drop in a single script tag or npm install and capture errors, network requests, console output, page views, and user interactions without any manual setup.",
                    highlights: [
                        "Automatic error capture with source context",
                        "Network request monitoring with timing data",
                        "Console log interception and forwarding",
                        "Page view and user interaction tracking",
                        "Built-in PII sanitization with configurable rules",
                        "Configurable batching with exponential backoff retries",
                    ],
                    author: "Apperio Team",
                },
                {
                    version: "1.2.0",
                    title: "Alert System",
                    date: new Date("2025-10-20"),
                    category: "feature",
                    description: "A powerful rule-based alert engine that monitors your logs in real time and notifies you through your preferred channels when things go wrong. Set thresholds, define conditions, and stay on top of production issues.",
                    highlights: [
                        "Configurable alert rules with threshold and frequency conditions",
                        "Multi-channel notifications: Slack, email, and webhooks",
                        "Alert event timeline with status tracking",
                        "Auto-resolve for stale alerts",
                        "Escalation policies and maintenance windows",
                    ],
                    author: "Apperio Team",
                },
                {
                    version: "1.3.0",
                    title: "AI Insights & Anomaly Detection",
                    date: new Date("2026-01-10"),
                    category: "improvement",
                    description: "Leverage AI to surface patterns in your logs that you would otherwise miss. Natural language summaries, anomaly detection using statistical analysis, and intelligent suggestions to help you fix issues faster.",
                    highlights: [
                        "AI-powered log summaries and pattern recognition",
                        "Z-score based anomaly detection for error rate spikes",
                        "Heuristic suggestion engine for common issues",
                        "Regression detection across releases",
                        "Redis-cached insights for sub-second dashboard loads",
                    ],
                    author: "Apperio Team",
                },
                {
                    version: "1.4.0",
                    title: "Enterprise Features",
                    date: new Date("2026-02-14"),
                    category: "security",
                    description: "Enterprise-grade features for organizations that need granular access control, billing management, and administrative oversight. Includes organization hierarchy, team management, and role-based permissions.",
                    highlights: [
                        "Organization and team management with role-based access",
                        "Admin dashboard with platform-wide KPIs",
                        "Billing and subscription management",
                        "Personal API tokens for CI/CD integration",
                        "Advanced data retention policies",
                        "Source map upload for minified stack traces",
                    ],
                    author: "Apperio Team",
                },
                {
                    version: "1.5.0",
                    title: "Integrations & Web Vitals",
                    date: new Date("2026-03-05"),
                    category: "feature",
                    description: "Connect Apperio to your existing workflow with first-class integrations. Plus, capture Core Web Vitals and distributed traces for end-to-end performance visibility across your entire stack.",
                    highlights: [
                        "Integration testing framework for GitHub, Jira, PagerDuty, Discord, Teams, and Linear",
                        "Core Web Vitals (LCP, FID, CLS, INP, TTFB) capture and analysis",
                        "Distributed tracing with trace and span correlation",
                        "Custom dashboards with drag-and-drop widgets",
                        "Funnel analysis for user journey tracking",
                    ],
                    author: "Apperio Team",
                },
            ];
            await changelog_model_1.ChangelogModel.insertMany(seedEntries);
            logger_1.default.info(`Seeded ${seedEntries.length} changelog entries`);
        }
        catch (error) {
            logger_1.default.error("Failed to seed changelog entries", {
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
}
exports.ChangelogService = ChangelogService;
