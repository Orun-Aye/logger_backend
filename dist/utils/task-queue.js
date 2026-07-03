"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiQueue = exports.webhookQueue = exports.TaskQueue = void 0;
const logger_1 = __importDefault(require("./logger"));
/**
 * Minimal in-process async task queue with bounded concurrency.
 *
 * Used for webhook processing and AI summarization so HTTP handlers can
 * acknowledge fast and defer the work. Tasks are best-effort: failures are
 * logged, not retried (webhook idempotency records make redelivery safe).
 *
 * If Apperio moves to multi-instance or serverless-only deploys, replace
 * this with a Redis-backed queue (BullMQ) behind the same enqueue API.
 */
class TaskQueue {
    name;
    concurrency;
    maxPending;
    queue = [];
    running = 0;
    constructor(name, concurrency = 2, maxPending = 500) {
        this.name = name;
        this.concurrency = concurrency;
        this.maxPending = maxPending;
    }
    /** Number of tasks waiting or running. */
    get size() {
        return this.queue.length + this.running;
    }
    enqueue(label, task) {
        if (this.queue.length >= this.maxPending) {
            logger_1.default.warn(`TaskQueue[${this.name}] full — dropping task`, { label });
            return false;
        }
        this.queue.push(async () => {
            try {
                await task();
            }
            catch (error) {
                logger_1.default.error(`TaskQueue[${this.name}] task failed`, {
                    label,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        });
        this.drain();
        return true;
    }
    drain() {
        while (this.running < this.concurrency && this.queue.length > 0) {
            const task = this.queue.shift();
            this.running++;
            void task().finally(() => {
                this.running--;
                this.drain();
            });
        }
    }
}
exports.TaskQueue = TaskQueue;
/** Queue for inbound webhook event processing. */
exports.webhookQueue = new TaskQueue("webhooks", 2);
/** Queue for AI summarization work (kept separate so a burst of pushes cannot starve webhook handling). */
exports.aiQueue = new TaskQueue("ai", 1);
