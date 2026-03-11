"use strict";
// src/services/database-monitor.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseMonitorService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("../utils/logger"));
const log_model_1 = require("../models/log.model");
const project_model_1 = require("../models/project.model");
const user_model_1 = require("../models/user.model");
const alertEvent_model_1 = require("../models/alertEvent.model");
const alertRule_model_1 = require("../models/alertRule.model");
/**
 * Database monitoring service
 */
class DatabaseMonitorService {
    /**
     * Get collection statistics
     */
    static async getCollectionStats(collectionName) {
        try {
            const stats = await mongoose_1.default.connection.db.command({
                collStats: collectionName,
            });
            return {
                name: collectionName,
                count: stats.count,
                size: stats.size,
                avgObjSize: stats.avgObjSize,
                storageSize: stats.storageSize,
                indexes: stats.nindexes,
                indexSize: stats.totalIndexSize,
            };
        }
        catch (error) {
            logger_1.default.error(`Failed to get stats for collection ${collectionName}`, {
                error: error instanceof Error ? error.message : "Unknown error",
            });
            return null;
        }
    }
    /**
     * Get database-wide statistics
     */
    static async getDatabaseStats() {
        const collectionNames = ["logs", "projects", "users", "alertevents", "alertrules"];
        const collectionStats = await Promise.all(collectionNames.map((name) => this.getCollectionStats(name)));
        const validStats = collectionStats.filter((stat) => stat !== null);
        const totalSize = validStats.reduce((sum, stat) => sum + stat.size, 0);
        const totalIndexSize = validStats.reduce((sum, stat) => sum + stat.indexSize, 0);
        const totalDocuments = validStats.reduce((sum, stat) => sum + stat.count, 0);
        return {
            collections: validStats,
            totalSize,
            totalIndexSize,
            totalDocuments,
        };
    }
    /**
     * List all indexes across collections
     */
    static async listAllIndexes() {
        const models = [
            { name: "logs", model: log_model_1.LogModel },
            { name: "projects", model: project_model_1.ProjectModel },
            { name: "users", model: user_model_1.UserModel },
            { name: "alertevents", model: alertEvent_model_1.AlertEventModel },
            { name: "alertrules", model: alertRule_model_1.AlertRuleModel },
        ];
        const allIndexes = [];
        for (const { name, model } of models) {
            try {
                const indexes = await model.collection.indexes();
                for (const index of indexes) {
                    allIndexes.push({
                        collection: name,
                        name: index.name,
                        keys: index.key,
                        unique: index.unique,
                        sparse: index.sparse,
                    });
                }
            }
            catch (error) {
                logger_1.default.error(`Failed to list indexes for ${name}`, {
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }
        return allIndexes;
    }
    /**
     * Verify required indexes exist
     */
    static async verifyIndexes() {
        const requiredIndexes = {
            logs: [
                "projectId_1_timestamp_-1",
                "projectId_1_level_1",
                "projectId_1_eventType_1",
            ],
            projects: ["ownerId_1", "apiKey_1"],
            users: ["email_1"],
            alertevents: ["projectId_1_triggeredAt_-1"],
            alertrules: ["projectId_1"],
        };
        const allIndexes = await this.listAllIndexes();
        const missing = [];
        const existing = [];
        for (const [collection, indexes] of Object.entries(requiredIndexes)) {
            const collectionIndexes = allIndexes
                .filter((idx) => idx.collection === collection)
                .map((idx) => idx.name);
            for (const requiredIndex of indexes) {
                const fullName = `${collection}.${requiredIndex}`;
                if (collectionIndexes.includes(requiredIndex)) {
                    existing.push(fullName);
                }
                else {
                    missing.push(fullName);
                }
            }
        }
        return {
            verified: missing.length === 0,
            missing,
            existing,
        };
    }
    /**
     * Analyze slow queries (requires MongoDB profiling to be enabled)
     */
    static async getSlowQueries(limit = 10) {
        try {
            const systemProfile = mongoose_1.default.connection.db.collection("system.profile");
            const slowQueries = await systemProfile
                .find({ millis: { $gt: 100 } }) // Queries taking more than 100ms
                .sort({ ts: -1 })
                .limit(limit)
                .toArray();
            return slowQueries;
        }
        catch (error) {
            logger_1.default.warn("Could not retrieve slow queries (profiling may not be enabled)", {
                error: error instanceof Error ? error.message : "Unknown error",
            });
            return [];
        }
    }
    /**
     * Get connection pool statistics
     */
    static getConnectionPoolStats() {
        const client = mongoose_1.default.connection.getClient();
        return {
            current: client.topology?.s?.pool?.totalConnectionCount || 0,
            available: client.topology?.s?.pool?.availableConnectionCount || 0,
            maxPoolSize: mongoose_1.default.connection.getClient().options.maxPoolSize || 10,
        };
    }
    /**
     * Monitor query performance
     */
    static async monitorQuery(queryFn, metadata) {
        const startTime = Date.now();
        const result = await queryFn();
        const executionTime = Date.now() - startTime;
        const metrics = {
            collection: metadata.collection,
            operation: metadata.operation,
            executionTime,
            docsExamined: 0, // Would need to use explain() to get this
            docsReturned: Array.isArray(result) ? result.length : 1,
        };
        // Log slow queries
        if (executionTime > 1000) {
            logger_1.default.warn("Slow query detected", metrics);
        }
        return { result, metrics };
    }
    /**
     * Check database health
     */
    static async checkHealth() {
        const startTime = Date.now();
        try {
            await mongoose_1.default.connection.db.admin().ping();
            const latency = Date.now() - startTime;
            const poolStats = this.getConnectionPoolStats();
            return {
                healthy: true,
                latency,
                connectionCount: poolStats.current,
            };
        }
        catch (error) {
            return {
                healthy: false,
                latency: Date.now() - startTime,
                connectionCount: 0,
            };
        }
    }
    /**
     * Get database size in human-readable format
     */
    static formatBytes(bytes) {
        if (bytes === 0)
            return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
    }
}
exports.DatabaseMonitorService = DatabaseMonitorService;
