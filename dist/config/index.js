"use strict";
// src/config/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTest = exports.isDevelopment = exports.isProduction = exports.config = void 0;
exports.initializeConfig = initializeConfig;
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
/**
 * Required environment variables
 */
const requiredEnvVars = [
    "MONGODB_URI",
    "JWT_SECRET",
    "PORT",
];
/**
 * Optional environment variables with defaults
 */
const optionalEnvVars = {
    NODE_ENV: "development",
    REDIS_URL: "redis://localhost:6379",
    CORS_ORIGIN: "http://localhost:3000",
    JWT_EXPIRY: "10h",
    API_VERSION: "v1",
    LOG_LEVEL: "info",
};
/**
 * Validate that all required environment variables are present
 */
function validateEnv() {
    const missing = [];
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}\n` +
            `Please check your .env file or environment configuration.`);
    }
}
/**
 * Get environment variable with type safety
 */
function getEnv(key, defaultValue) {
    const value = process.env[key];
    if (!value && defaultValue === undefined) {
        throw new Error(`Environment variable ${key} is not set`);
    }
    return value || defaultValue || "";
}
/**
 * Get environment variable as number
 */
function getEnvAsNumber(key, defaultValue) {
    const value = process.env[key];
    if (!value) {
        if (defaultValue === undefined) {
            throw new Error(`Environment variable ${key} is not set`);
        }
        return defaultValue;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} must be a number`);
    }
    return parsed;
}
/**
 * Get environment variable as boolean
 */
function getEnvAsBoolean(key, defaultValue = false) {
    const value = process.env[key];
    if (!value)
        return defaultValue;
    return value.toLowerCase() === "true" || value === "1";
}
/**
 * Centralized configuration object
 */
exports.config = {
    /**
     * Node environment
     */
    env: getEnv("NODE_ENV", optionalEnvVars.NODE_ENV),
    /**
     * Server configuration
     */
    server: {
        port: getEnvAsNumber("PORT", 5000),
        apiVersion: getEnv("API_VERSION", optionalEnvVars.API_VERSION),
        baseUrl: getEnv("BASE_URL", `http://localhost:${getEnvAsNumber("PORT", 5000)}`),
    },
    /**
     * Database configuration
     */
    database: {
        uri: getEnv("MONGODB_URI"),
        options: {
            maxPoolSize: getEnvAsNumber("DB_POOL_SIZE", 10),
            serverSelectionTimeoutMS: getEnvAsNumber("DB_TIMEOUT", 5000),
            socketTimeoutMS: getEnvAsNumber("DB_SOCKET_TIMEOUT", 45000),
        },
    },
    /**
     * Redis configuration
     */
    redis: {
        url: getEnv("REDIS_URL", optionalEnvVars.REDIS_URL),
        enabled: getEnvAsBoolean("REDIS_ENABLED", true),
        ttl: getEnvAsNumber("REDIS_TTL", 300), // Default 5 minutes
    },
    /**
     * JWT configuration
     */
    jwt: {
        secret: getEnv("JWT_SECRET"),
        expiry: getEnv("JWT_EXPIRY", optionalEnvVars.JWT_EXPIRY),
        refreshExpiry: getEnv("JWT_REFRESH_EXPIRY", "7d"),
    },
    /**
     * CORS configuration
     */
    cors: {
        origin: getEnv("CORS_ORIGIN", optionalEnvVars.CORS_ORIGIN)
            .split(",")
            .map((origin) => origin.trim()),
        credentials: true,
    },
    /**
     * Rate limiting configuration
     */
    rateLimit: {
        windowMs: getEnvAsNumber("RATE_LIMIT_WINDOW_MS", 60000), // 1 minute
        max: getEnvAsNumber("RATE_LIMIT_MAX", 100),
        logIngestionMax: getEnvAsNumber("LOG_INGESTION_RATE_LIMIT", 1000),
    },
    /**
     * Email configuration (SMTP + Resend)
     */
    email: {
        enabled: getEnvAsBoolean("EMAIL_ENABLED", false),
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: getEnvAsNumber("SMTP_PORT", 587),
        secure: getEnvAsBoolean("SMTP_SECURE", false),
        user: process.env.SMTP_USER || "",
        password: process.env.SMTP_PASSWORD || "",
        from: process.env.SMTP_FROM || "noreply@apperio.dev",
        resendApiKey: process.env.RESEND_API_KEY || "",
    },
    /**
     * Slack configuration
     */
    slack: {
        enabled: getEnvAsBoolean("SLACK_ENABLED", false),
        defaultWebhookUrl: process.env.SLACK_WEBHOOK_URL || "",
    },
    /**
     * Anthropic (Claude) configuration
     */
    anthropic: {
        enabled: getEnvAsBoolean("ANTHROPIC_ENABLED", false),
        apiKey: process.env.ANTHROPIC_API_KEY || "",
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    },
    /**
     * WebSocket configuration
     */
    websocket: {
        enabled: getEnvAsBoolean("WEBSOCKET_ENABLED", true),
        pingInterval: getEnvAsNumber("WS_PING_INTERVAL", 30000),
        pingTimeout: getEnvAsNumber("WS_PING_TIMEOUT", 5000),
    },
    /**
     * Logging configuration
     */
    logging: {
        level: getEnv("LOG_LEVEL", optionalEnvVars.LOG_LEVEL),
        enableFileLogging: getEnvAsBoolean("LOG_FILE_ENABLED", process.env.NODE_ENV === "production"),
    },
    /**
     * Security configuration
     */
    security: {
        bcryptRounds: getEnvAsNumber("BCRYPT_ROUNDS", 10),
        sessionTimeout: getEnvAsNumber("SESSION_TIMEOUT", 3600000), // 1 hour
    },
    /**
     * Feature flags
     */
    features: {
        aiInsights: getEnvAsBoolean("FEATURE_AI_INSIGHTS", false),
        anomalyDetection: getEnvAsBoolean("FEATURE_ANOMALY_DETECTION", false),
        webhooks: getEnvAsBoolean("FEATURE_WEBHOOKS", true),
    },
    /**
     * Frontend URL (for redirects, emails, etc.)
     */
    frontend: {
        url: getEnv("FRONTEND_URL", "http://localhost:3000"),
    },
    /**
     * OAuth configuration
     */
    oauth: {
        github: {
            clientId: getEnv("GITHUB_CLIENT_ID", ""),
            clientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
            redirectUri: getEnv("GITHUB_REDIRECT_URI", ""),
        },
        google: {
            clientId: getEnv("GOOGLE_CLIENT_ID", ""),
            clientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
            redirectUri: getEnv("GOOGLE_REDIRECT_URI", ""),
        },
    },
    /**
     * GitHub App configuration (Change Intelligence — webhooks, installation tokens).
     * All three values must be set for the GitHub App features to activate;
     * otherwise the platform falls back to user-OAuth-based repo access.
     */
    githubApp: {
        appId: getEnv("GITHUB_APP_ID", ""),
        // PEM private key. Supports literal "\n" escapes (common in env UIs) and
        // a base64-encoded variant via GITHUB_APP_PRIVATE_KEY_BASE64.
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY_BASE64
            ? Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY_BASE64, "base64").toString("utf8")
            : (process.env.GITHUB_APP_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        webhookSecret: getEnv("GITHUB_WEBHOOK_SECRET", ""),
        /** App slug, used to build the public install URL. */
        slug: getEnv("GITHUB_APP_SLUG", "apperio"),
    },
    /**
     * Data retention configuration
     */
    retention: {
        defaultDays: getEnvAsNumber("RETENTION_DEFAULT_DAYS", 30),
        cronSchedule: getEnv("RETENTION_CRON_SCHEDULE", "0 2 * * *"),
        enabled: getEnvAsBoolean("RETENTION_JOB_ENABLED", true),
    },
};
/**
 * Initialize and validate configuration
 */
function initializeConfig() {
    try {
        validateEnv();
        console.log("✓ Configuration validated successfully");
        console.log(`✓ Environment: ${exports.config.env}`);
        console.log(`✓ Port: ${exports.config.server.port}`);
        console.log(`✓ Database: ${exports.config.database.uri.split("@")[1] || "configured"}`);
        console.log(`✓ Redis: ${exports.config.redis.enabled ? "enabled" : "disabled"}`);
    }
    catch (error) {
        console.error("✗ Configuration validation failed:");
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    }
}
/**
 * Check if running in production
 */
exports.isProduction = exports.config.env === "production";
/**
 * Check if running in development
 */
exports.isDevelopment = exports.config.env === "development";
/**
 * Check if running in test
 */
exports.isTest = exports.config.env === "test";
exports.default = exports.config;
