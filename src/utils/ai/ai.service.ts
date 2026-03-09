import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config";
import logger from "../logger";

// Rate-limit tracking per project
const tokenUsage: Map<string, { tokens: number; resetAt: number }> = new Map();
const MAX_TOKENS_PER_HOUR = 50_000;

/**
 * AIService — Anthropic Claude-powered intelligence layer.
 *
 * All methods gracefully degrade when the API is unavailable,
 * returning null so callers can fall back to heuristic responses.
 */
export class AIService {
  private static client: Anthropic | null = null;

  private static getClient(): Anthropic | null {
    if (!this.isAvailable()) return null;
    if (!this.client) {
      this.client = new Anthropic({
        apiKey: config.anthropic.apiKey,
      });
    }
    return this.client;
  }

  /** Check if the AI service is configured and enabled */
  static isAvailable(): boolean {
    return config.anthropic.enabled && !!config.anthropic.apiKey;
  }

  /** Check per-project rate limit */
  private static checkRateLimit(projectId: string): boolean {
    const now = Date.now();
    const entry = tokenUsage.get(projectId);

    if (!entry || now > entry.resetAt) {
      tokenUsage.set(projectId, { tokens: 0, resetAt: now + 60 * 60 * 1000 });
      return true;
    }

    return entry.tokens < MAX_TOKENS_PER_HOUR;
  }

  /** Track token usage */
  private static trackUsage(projectId: string, inputTokens: number, outputTokens: number): void {
    const now = Date.now();
    const entry = tokenUsage.get(projectId) || { tokens: 0, resetAt: now + 60 * 60 * 1000 };

    entry.tokens += inputTokens;
    tokenUsage.set(projectId, entry);

    logger.debug("AI token usage", {
      projectId,
      inputTokens,
      outputTokens,
      totalUsed: entry.tokens,
      limit: MAX_TOKENS_PER_HOUR,
    });
  }

  /**
   * Analyze a group of error messages to determine root cause
   */
  static async analyzeErrorGroup(
    errorMessages: string[],
    context: { projectId: string; service?: string; environment?: string }
  ): Promise<string | null> {
    const client = this.getClient();
    if (!client || !this.checkRateLimit(context.projectId)) return null;

    try {
      const response = await client.messages.create({
        model: config.anthropic.model,
        max_tokens: 1024,
        system:
          "You are an expert software engineer specializing in debugging and root cause analysis. " +
          "Analyze the error messages and provide a concise root cause analysis. " +
          "Be specific about what's likely going wrong and suggest fixes. " +
          "Format your response in plain text, keeping it under 300 words.",
        messages: [
          {
            role: "user",
            content: `Analyze these ${errorMessages.length} error messages from ${context.service || "the application"} (${context.environment || "unknown"} environment):\n\n${errorMessages.slice(0, 20).join("\n\n")}`,
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : null;
      this.trackUsage(context.projectId, response.usage.input_tokens, response.usage.output_tokens);
      return text;
    } catch (error) {
      logger.error("AI analyzeErrorGroup failed", { error, projectId: context.projectId });
      return null;
    }
  }

  /**
   * Generate a natural language summary of statistical insights
   */
  static async generateInsightSummary(
    statisticalInsights: Record<string, any>,
    projectId: string
  ): Promise<string | null> {
    const client = this.getClient();
    if (!client || !this.checkRateLimit(projectId)) return null;

    try {
      const response = await client.messages.create({
        model: config.anthropic.model,
        max_tokens: 2048,
        system:
          "You are Apperio, an observability platform assistant. " +
          "Generate a concise, actionable health summary from the statistical data provided. " +
          "Highlight the most important findings first. Use plain language, avoid jargon. " +
          "If there are concerning trends, call them out specifically. " +
          "Keep your response to 3-5 sentences maximum.",
        messages: [
          {
            role: "user",
            content: `Here is the statistical summary for this project:\n\n${JSON.stringify(statisticalInsights, null, 2)}\n\nProvide a brief health assessment.`,
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : null;
      this.trackUsage(projectId, response.usage.input_tokens, response.usage.output_tokens);
      return text;
    } catch (error) {
      logger.error("AI generateInsightSummary failed", { error, projectId });
      return null;
    }
  }

  /**
   * Answer a natural language question about the project
   */
  static async answerQuestion(
    question: string,
    projectContext: Record<string, any>,
    projectId: string
  ): Promise<string | null> {
    const client = this.getClient();
    if (!client || !this.checkRateLimit(projectId)) return null;

    try {
      const response = await client.messages.create({
        model: config.anthropic.model,
        max_tokens: 512,
        system:
          "You are Apperio, an observability platform assistant. " +
          "Answer the user's question about their application based on the provided data context. " +
          "Be concise and specific. If you cannot determine the answer from the data, say so. " +
          "Suggest what additional data or filters might help answer the question.",
        messages: [
          {
            role: "user",
            content: `Project data context:\n${JSON.stringify(projectContext, null, 2)}\n\nQuestion: ${question}`,
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : null;
      this.trackUsage(projectId, response.usage.input_tokens, response.usage.output_tokens);
      return text;
    } catch (error) {
      logger.error("AI answerQuestion failed", { error, projectId });
      return null;
    }
  }

  /**
   * Generate optimization suggestions from performance data
   */
  static async suggestOptimizations(
    performanceData: Record<string, any>,
    projectId: string
  ): Promise<Array<{ title: string; description: string; priority: string }> | null> {
    const client = this.getClient();
    if (!client || !this.checkRateLimit(projectId)) return null;

    try {
      const response = await client.messages.create({
        model: config.anthropic.model,
        max_tokens: 1024,
        system:
          "You are Apperio, an observability platform assistant specializing in performance optimization. " +
          "Based on the performance data, suggest concrete optimizations. " +
          "Return a JSON array of objects with keys: title (short), description (1-2 sentences), priority (high/medium/low). " +
          "Limit to the top 5 most impactful suggestions. Return ONLY the JSON array, no other text.",
        messages: [
          {
            role: "user",
            content: `Performance data:\n${JSON.stringify(performanceData, null, 2)}`,
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : null;
      this.trackUsage(projectId, response.usage.input_tokens, response.usage.output_tokens);

      if (!text) return null;

      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(text);
      } catch {
        logger.warn("Failed to parse AI optimization suggestions", { text });
        return null;
      }
    } catch (error) {
      logger.error("AI suggestOptimizations failed", { error, projectId });
      return null;
    }
  }

  /**
   * Explain why an anomaly occurred
   */
  static async explainAnomaly(
    anomalyData: Record<string, any>,
    projectId: string
  ): Promise<string | null> {
    const client = this.getClient();
    if (!client || !this.checkRateLimit(projectId)) return null;

    try {
      const response = await client.messages.create({
        model: config.anthropic.model,
        max_tokens: 512,
        system:
          "You are Apperio, an observability platform assistant. " +
          "Explain in plain language why this anomaly likely occurred and what the team should investigate. " +
          "Be specific and actionable. Keep your response under 150 words.",
        messages: [
          {
            role: "user",
            content: `Anomaly detected:\n${JSON.stringify(anomalyData, null, 2)}\n\nExplain what likely caused this.`,
          },
        ],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : null;
      this.trackUsage(projectId, response.usage.input_tokens, response.usage.output_tokens);
      return text;
    } catch (error) {
      logger.error("AI explainAnomaly failed", { error, projectId });
      return null;
    }
  }
}
