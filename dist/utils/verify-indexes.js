"use strict";
// src/utils/verify-indexes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAndCreateIndexes = verifyAndCreateIndexes;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config");
const logger_1 = __importDefault(require("./logger"));
const log_model_1 = require("../models/log.model");
const project_model_1 = require("../models/project.model");
const alertEvent_model_1 = require("../models/alertEvent.model");
const alertRule_model_1 = require("../models/alertRule.model");
/**
 * Additional compound indexes to ensure optimal query performance
 */
const additionalIndexes = [
    {
        model: log_model_1.LogModel,
        name: "logs",
        indexes: [
            { keys: { projectId: 1, service: 1 }, options: {} },
            { keys: { projectId: 1, environment: 1 }, options: {} },
            { keys: { projectId: 1, createdAt: -1 }, options: {} },
            {
                keys: { message: "text" },
                options: { name: "message_text" },
            },
        ],
    },
    {
        model: project_model_1.ProjectModel,
        name: "projects",
        indexes: [
            { keys: { ownerId: 1, isActive: 1 }, options: {} },
            { keys: { "teamMembers.userId": 1 }, options: {} },
            { keys: { tags: 1 }, options: {} },
            { keys: { createdAt: -1 }, options: {} },
        ],
    },
    {
        model: alertEvent_model_1.AlertEventModel,
        name: "alertevents",
        indexes: [
            { keys: { projectId: 1, status: 1 }, options: {} },
            { keys: { projectId: 1, severity: 1 }, options: {} },
            { keys: { ruleId: 1, triggeredAt: -1 }, options: {} },
        ],
    },
    {
        model: alertRule_model_1.AlertRuleModel,
        name: "alertrules",
        indexes: [
            { keys: { projectId: 1, isActive: 1 }, options: {} },
            { keys: { createdBy: 1 }, options: {} },
        ],
    },
];
/**
 * Verify and create missing indexes
 */
async function verifyAndCreateIndexes() {
    try {
        logger_1.default.info("Starting index verification...");
        // Connect to database
        await mongoose_1.default.connect(config_1.config.database.uri);
        logger_1.default.info("Connected to database");
        for (const { model, name, indexes } of additionalIndexes) {
            logger_1.default.info(`Checking indexes for ${name}...`);
            for (const { keys, options } of indexes) {
                try {
                    // Check if index exists
                    const existingIndexes = await model.collection.indexes();
                    const indexName = options.name || Object.keys(keys).join("_");
                    const exists = existingIndexes.some((idx) => idx.name === indexName);
                    if (exists) {
                        logger_1.default.info(`✓ Index ${indexName} already exists on ${name}`);
                    }
                    else {
                        // Create index
                        logger_1.default.info(`Creating index ${indexName} on ${name}...`);
                        await model.collection.createIndex(keys, options);
                        logger_1.default.info(`✓ Created index ${indexName} on ${name}`);
                    }
                }
                catch (error) {
                    logger_1.default.error(`Failed to create index on ${name}`, {
                        error: error instanceof Error ? error.message : "Unknown error",
                        keys,
                    });
                }
            }
        }
        // List all indexes
        logger_1.default.info("\n=== Current Indexes ===");
        for (const { model, name } of additionalIndexes) {
            const indexes = await model.collection.indexes();
            logger_1.default.info(`\n${name}:`);
            indexes.forEach((idx) => {
                logger_1.default.info(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
            });
        }
        logger_1.default.info("\n✓ Index verification complete");
    }
    catch (error) {
        logger_1.default.error("Index verification failed", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        process.exit(1);
    }
    finally {
        await mongoose_1.default.connection.close();
        process.exit(0);
    }
}
// Run if executed directly
if (require.main === module) {
    verifyAndCreateIndexes();
}
