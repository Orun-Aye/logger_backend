// src/utils/verify-indexes.ts

import mongoose from "mongoose";
import { config } from "../config";
import logger from "./logger";
import { LogModel } from "../models/log.model";
import { ProjectModel } from "../models/project.model";
import { UserModel } from "../models/user.model";
import { AlertEventModel } from "../models/alertEvent.model";
import { AlertRuleModel } from "../models/alertRule.model";

/**
 * Additional compound indexes to ensure optimal query performance
 */
const additionalIndexes = [
  {
    model: LogModel,
    name: "logs",
    indexes: [
      { keys: { projectId: 1, service: 1 } as any, options: {} },
      { keys: { projectId: 1, environment: 1 } as any, options: {} },
      { keys: { projectId: 1, createdAt: -1 } as any, options: {} },
      {
        keys: { message: "text" } as any,
        options: { name: "message_text" } as any,
      },
    ],
  },
  {
    model: ProjectModel,
    name: "projects",
    indexes: [
      { keys: { ownerId: 1, isActive: 1 } as any, options: {} },
      { keys: { "teamMembers.userId": 1 } as any, options: {} },
      { keys: { tags: 1 } as any, options: {} },
      { keys: { createdAt: -1 } as any, options: {} },
    ],
  },
  {
    model: AlertEventModel,
    name: "alertevents",
    indexes: [
      { keys: { projectId: 1, status: 1 } as any, options: {} },
      { keys: { projectId: 1, severity: 1 } as any, options: {} },
      { keys: { ruleId: 1, triggeredAt: -1 } as any, options: {} },
    ],
  },
  {
    model: AlertRuleModel,
    name: "alertrules",
    indexes: [
      { keys: { projectId: 1, isActive: 1 } as any, options: {} },
      { keys: { createdBy: 1 } as any, options: {} },
    ],
  },
];

/**
 * Verify and create missing indexes
 */
async function verifyAndCreateIndexes() {
  try {
    logger.info("Starting index verification...");

    // Connect to database
    await mongoose.connect(config.database.uri);
    logger.info("Connected to database");

    for (const { model, name, indexes } of additionalIndexes) {
      logger.info(`Checking indexes for ${name}...`);

      for (const { keys, options } of indexes) {
        try {
          // Check if index exists
          const existingIndexes = await model.collection.indexes();
          const indexName = (options as any).name || Object.keys(keys).join("_");

          const exists = existingIndexes.some((idx) => idx.name === indexName);

          if (exists) {
            logger.info(`✓ Index ${indexName} already exists on ${name}`);
          } else {
            // Create index
            logger.info(`Creating index ${indexName} on ${name}...`);
            await model.collection.createIndex(keys, options);
            logger.info(`✓ Created index ${indexName} on ${name}`);
          }
        } catch (error) {
          logger.error(`Failed to create index on ${name}`, {
            error: error instanceof Error ? error.message : "Unknown error",
            keys,
          });
        }
      }
    }

    // List all indexes
    logger.info("\n=== Current Indexes ===");
    for (const { model, name } of additionalIndexes) {
      const indexes = await model.collection.indexes();
      logger.info(`\n${name}:`);
      indexes.forEach((idx) => {
        logger.info(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
      });
    }

    logger.info("\n✓ Index verification complete");
  } catch (error) {
    logger.error("Index verification failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  verifyAndCreateIndexes();
}

export { verifyAndCreateIndexes };
