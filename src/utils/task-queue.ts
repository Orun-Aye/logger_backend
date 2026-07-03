import logger from "./logger";

type Task = () => Promise<void>;

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
export class TaskQueue {
  private queue: Task[] = [];
  private running = 0;

  constructor(
    private readonly name: string,
    private readonly concurrency: number = 2,
    private readonly maxPending: number = 500
  ) {}

  /** Number of tasks waiting or running. */
  get size(): number {
    return this.queue.length + this.running;
  }

  enqueue(label: string, task: Task): boolean {
    if (this.queue.length >= this.maxPending) {
      logger.warn(`TaskQueue[${this.name}] full — dropping task`, { label });
      return false;
    }
    this.queue.push(async () => {
      try {
        await task();
      } catch (error) {
        logger.error(`TaskQueue[${this.name}] task failed`, {
          label,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
    this.drain();
    return true;
  }

  private drain(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running++;
      void task().finally(() => {
        this.running--;
        this.drain();
      });
    }
  }
}

/** Queue for inbound webhook event processing. */
export const webhookQueue = new TaskQueue("webhooks", 2);

/** Queue for AI summarization work (kept separate so a burst of pushes cannot starve webhook handling). */
export const aiQueue = new TaskQueue("ai", 1);
