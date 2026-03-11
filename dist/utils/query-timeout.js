"use strict";
// src/utils/query-timeout.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryTimeouts = void 0;
exports.withTimeout = withTimeout;
exports.withAggregateTimeout = withAggregateTimeout;
exports.monitorSlowQueries = monitorSlowQueries;
exports.setGlobalQueryTimeout = setGlobalQueryTimeout;
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("./logger"));
/**
 * Default query timeout in milliseconds
 */
const DEFAULT_QUERY_TIMEOUT = 10000; // 10 seconds
/**
 * Query timeout configuration per operation type
 */
exports.queryTimeouts = {
    find: 10000, // 10 seconds for read operations
    aggregate: 30000, // 30 seconds for aggregations
    insert: 5000, // 5 seconds for inserts
    update: 5000, // 5 seconds for updates
    delete: 5000, // 5 seconds for deletes
};
/**
 * Wrapper to add timeout to mongoose queries
 */
function withTimeout(query, timeout = DEFAULT_QUERY_TIMEOUT, operationName) {
    return query.maxTimeMS(timeout).catch((error) => {
        if (error.name === "MongooseError" && error.message.includes("maxTimeMS")) {
            logger_1.default.error("Query timeout exceeded", {
                operation: operationName || "unknown",
                timeout,
            });
            throw new Error(`Query timeout exceeded (${timeout}ms)`);
        }
        throw error;
    });
}
/**
 * Wrapper for aggregate pipelines with timeout
 */
function withAggregateTimeout(aggregate, timeout = exports.queryTimeouts.aggregate, operationName) {
    return aggregate.option({ maxTimeMS: timeout }).catch((error) => {
        if (error.name === "MongooseError" && error.message.includes("maxTimeMS")) {
            logger_1.default.error("Aggregation timeout exceeded", {
                operation: operationName || "unknown",
                timeout,
            });
            throw new Error(`Aggregation timeout exceeded (${timeout}ms)`);
        }
        throw error;
    });
}
/**
 * Monitor and log slow queries
 */
function monitorSlowQueries() {
    mongoose_1.default.set("debug", (collectionName, method, query, doc, options) => {
        const startTime = Date.now();
        // Log query details
        logger_1.default.debug("MongoDB Query", {
            collection: collectionName,
            method,
            query: JSON.stringify(query),
        });
        // Monitor completion time
        process.nextTick(() => {
            const duration = Date.now() - startTime;
            if (duration > 1000) {
                // Log queries taking more than 1 second
                logger_1.default.warn("Slow query detected", {
                    collection: collectionName,
                    method,
                    query: JSON.stringify(query),
                    duration: `${duration}ms`,
                });
            }
        });
    });
}
/**
 * Set global query timeout for all queries
 */
function setGlobalQueryTimeout(timeout = DEFAULT_QUERY_TIMEOUT) {
    // Set default maxTimeMS for all queries
    mongoose_1.default.plugin((schema) => {
        schema.pre("find", function () {
            this.maxTimeMS(exports.queryTimeouts.find);
        });
        schema.pre("findOne", function () {
            this.maxTimeMS(exports.queryTimeouts.find);
        });
        schema.pre("updateOne", function () {
            this.maxTimeMS(exports.queryTimeouts.update);
        });
        schema.pre("updateMany", function () {
            this.maxTimeMS(exports.queryTimeouts.update);
        });
        schema.pre("deleteOne", function () {
            this.maxTimeMS(exports.queryTimeouts.delete);
        });
        schema.pre("deleteMany", function () {
            this.maxTimeMS(exports.queryTimeouts.delete);
        });
    });
    logger_1.default.info("Global query timeouts configured", exports.queryTimeouts);
}
