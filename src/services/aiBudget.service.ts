/**
 * AiBudgetService — per-project monthly cap on AI commit summaries.
 *
 * Callers reserve slots before calling the model and release any they did
 * not use (failed or skipped commits), so the count reflects summaries
 * actually produced. When the cap is reached, reservations grant 0 and the
 * caller falls back to showing the commit without a summary.
 */
import { AiUsageModel } from "../models/aiUsage.model";
import { config } from "../config";

/** Contended reservations retry this many times before granting nothing. */
const MAX_RESERVE_ATTEMPTS = 5;

export type SummaryReservation = {
  /** Slots granted, 0..requested. */
  granted: number;
  /** Month the slots were taken from, for releasing them later. */
  month: string;
};

export class AiBudgetService {
  /** "YYYY-MM" in UTC. */
  static monthKey(date: Date = new Date()): string {
    return date.toISOString().slice(0, 7);
  }

  static get monthlySummaryLimit(): number {
    return config.anthropic.monthlySummaryLimit;
  }

  /**
   * Reserve up to `requested` summary slots for this month. Grants fewer
   * (possibly 0) when the project is near or over its monthly cap.
   */
  static async reserveSummaries(
    projectId: string,
    requested: number,
    now: Date = new Date()
  ): Promise<SummaryReservation> {
    const month = this.monthKey(now);
    const limit = this.monthlySummaryLimit;
    if (requested <= 0 || limit <= 0) return { granted: 0, month };

    try {
      await AiUsageModel.updateOne(
        { projectId, month },
        { $setOnInsert: { summaries: 0 } },
        { upsert: true }
      );
    } catch (error: any) {
      // A concurrent reservation created the document first
      if (error?.code !== 11000) throw error;
    }

    for (let attempt = 0; attempt < MAX_RESERVE_ATTEMPTS; attempt++) {
      const usage = await AiUsageModel.findOne({ projectId, month })
        .select("summaries")
        .lean();
      const used = usage?.summaries ?? 0;
      const grant = Math.min(requested, limit - used);
      if (grant <= 0) return { granted: 0, month };

      // Only succeeds if taking `grant` still leaves us at or under the cap
      const result = await AiUsageModel.updateOne(
        { projectId, month, summaries: { $lte: limit - grant } },
        { $inc: { summaries: grant } }
      );
      if (result.modifiedCount === 1) return { granted: grant, month };
    }
    return { granted: 0, month };
  }

  /** Return unused slots to the month they were reserved from. */
  static async releaseSummaries(
    projectId: string,
    reservation: SummaryReservation,
    count: number
  ): Promise<void> {
    const n = Math.min(count, reservation.granted);
    if (n <= 0) return;
    await AiUsageModel.updateOne({ projectId, month: reservation.month }, [
      { $set: { summaries: { $max: [0, { $subtract: ["$summaries", n] }] } } },
    ]);
  }

  static async getUsage(
    projectId: string,
    now: Date = new Date()
  ): Promise<{ month: string; used: number; limit: number }> {
    const month = this.monthKey(now);
    const usage = await AiUsageModel.findOne({ projectId, month })
      .select("summaries")
      .lean();
    return { month, used: usage?.summaries ?? 0, limit: this.monthlySummaryLimit };
  }
}
