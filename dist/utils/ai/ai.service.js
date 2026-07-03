"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const config_1 = require("../../config");
const logger_1 = __importDefault(require("../logger"));
// Rate-limit tracking per project
const tokenUsage = new Map();
const MAX_TOKENS_PER_HOUR = 50_000;
/**
 * AIService — Anthropic Claude-powered intelligence layer.
 *
 * All methods gracefully degrade when the API is unavailable,
 * returning null so callers can fall back to heuristic responses.
 */
class AIService {
    static client = null;
    static getClient() {
        if (!this.isAvailable())
            return null;
        if (!this.client) {
            this.client = new sdk_1.default({
                apiKey: config_1.config.anthropic.apiKey,
            });
        }
        return this.client;
    }
    /** Check if the AI service is configured and enabled */
    static isAvailable() {
        return config_1.config.anthropic.enabled && !!config_1.config.anthropic.apiKey;
    }
    /** Check per-project rate limit */
    static checkRateLimit(projectId) {
        const now = Date.now();
        const entry = tokenUsage.get(projectId);
        if (!entry || now > entry.resetAt) {
            tokenUsage.set(projectId, { tokens: 0, resetAt: now + 60 * 60 * 1000 });
            return true;
        }
        return entry.tokens < MAX_TOKENS_PER_HOUR;
    }
    /** Track token usage */
    static trackUsage(projectId, inputTokens, outputTokens) {
        const now = Date.now();
        const entry = tokenUsage.get(projectId) || { tokens: 0, resetAt: now + 60 * 60 * 1000 };
        entry.tokens += inputTokens;
        tokenUsage.set(projectId, entry);
        logger_1.default.debug("AI token usage", {
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
    static async analyzeErrorGroup(errorMessages, context) {
        const client = this.getClient();
        if (!client || !this.checkRateLimit(context.projectId))
            return null;
        try {
            const response = await client.messages.create({
                model: config_1.config.anthropic.model,
                max_tokens: 1024,
                system: "You are an expert software engineer specializing in debugging and root cause analysis. " +
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
        }
        catch (error) {
            logger_1.default.error("AI analyzeErrorGroup failed", { error, projectId: context.projectId });
            return null;
        }
    }
    /**
     * Generate a natural language summary of statistical insights
     */
    static async generateInsightSummary(statisticalInsights, projectId) {
        const client = this.getClient();
        if (!client || !this.checkRateLimit(projectId))
            return null;
        try {
            const response = await client.messages.create({
                model: config_1.config.anthropic.model,
                max_tokens: 2048,
                system: "You are Apperio, an observability platform assistant. " +
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
        }
        catch (error) {
            logger_1.default.error("AI generateInsightSummary failed", { error, projectId });
            return null;
        }
    }
    /**
     * Answer a natural language question about the project
     */
    static async answerQuestion(question, projectContext, projectId) {
        const client = this.getClient();
        if (!client || !this.checkRateLimit(projectId))
            return null;
        try {
            const response = await client.messages.create({
                model: config_1.config.anthropic.model,
                max_tokens: 512,
                system: "You are Apperio, an observability platform assistant. " +
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
        }
        catch (error) {
            logger_1.default.error("AI answerQuestion failed", { error, projectId });
            return null;
        }
    }
    /**
     * Generate optimization suggestions from performance data
     */
    static async suggestOptimizations(performanceData, projectId) {
        const client = this.getClient();
        if (!client || !this.checkRateLimit(projectId))
            return null;
        try {
            const response = await client.messages.create({
                model: config_1.config.anthropic.model,
                max_tokens: 1024,
                system: "You are Apperio, an observability platform assistant specializing in performance optimization. " +
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
            if (!text)
                return null;
            try {
                // Extract JSON from response (handle markdown code blocks)
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(text);
            }
            catch {
                logger_1.default.warn("Failed to parse AI optimization suggestions", { text });
                return null;
            }
        }
        catch (error) {
            logger_1.default.error("AI suggestOptimizations failed", { error, projectId });
            return null;
        }
    }
    /**
     * Explain why an anomaly occurred
     */
    static async explainAnomaly(anomalyData, projectId) {
        const client = this.getClient();
        if (!client || !this.checkRateLimit(projectId))
            return null;
        try {
            const response = await client.messages.create({
                model: config_1.config.anthropic.model,
                max_tokens: 512,
                system: "You are Apperio, an observability platform assistant. " +
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
        }
        catch (error) {
            logger_1.default.error("AI explainAnomaly failed", { error, projectId });
            return null;
        }
    }
    // ------------------------------------------------------------------
    // Change Intelligence (Phase 7)
    // ------------------------------------------------------------------
    /**
     * Summarize a batch of commits (one push) into plain-English one-liners.
     * Returns null when AI is unavailable or the response cannot be parsed.
     */
    static async summarizeCommitBatch(commits, projectId) {
        const client = this.getClient();
        if (!client || !this.checkRateLimit(projectId))
            return null;
        const input = commits
            .map((c) => `### Commit ${c.sha}\nMessage: ${c.message}\n\nDiff excerpt:\n${c.diffExcerpt || "(no diff available)"}`)
            .join("\n\n");
        try {
            const response = await client.messages.create({
                model: config_1.config.anthropic.model,
                max_tokens: 2048,
                system: "You are Apperio, an observability platform that explains code changes to app owners. " +
                    "For each commit, write two summaries of what actually changed in the app:\n" +
                    "1. summary: one sentence in plain English a NON-TECHNICAL founder understands. " +
                    "Describe the user-visible or practical effect (e.g. 'Fixed the checkout button not responding on mobile'). " +
                    "No jargon, no file names, no function names.\n" +
                    "2. technicalSummary: one sentence for developers naming the key components touched.\n" +
                    "Base your answer on the diff, not just the commit message — commit messages can be wrong. " +
                    "Return ONLY a JSON array of objects with keys: sha, summary, technicalSummary. No other text.",
                messages: [{ role: "user", content: input }],
            });
            const text = response.content[0]?.type === "text" ? response.content[0].text : null;
            this.trackUsage(projectId, response.usage.input_tokens, response.usage.output_tokens);
            if (!text)
                return null;
            try {
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
                if (!Array.isArray(parsed))
                    return null;
                return parsed.filter((item) => item && typeof item.sha === "string" && typeof item.summary === "string");
            }
            catch {
                logger_1.default.warn("Failed to parse AI commit summaries", { projectId });
                return null;
            }
        }
        catch (error) {
            logger_1.default.error("AI summarizeCommitBatch failed", { error, projectId });
            return null;
        }
    }
    /**
     * Longer plain-English explanation of a single commit ("Explain this change").
     */
    static async explainCommit(commit, projectId) {
        const client = this.getClient();
        if (!client || !this.checkRateLimit(projectId))
            return null;
        try {
            const response = await client.messages.create({
                model: config_1.config.anthropic.model,
                max_tokens: 1024,
                system: "You are Apperio, an observability platform that explains code changes to app owners. " +
                    "Explain this commit to someone who does not read code: what changed, why it likely changed, " +
                    "and what (if anything) the app owner should watch out for. " +
                    "Use short paragraphs, plain language, no code snippets, no file paths. Under 200 words.",
                messages: [
                    {
                        role: "user",
                        content: `Commit message: ${commit.message}\n\nDiff excerpt:\n${commit.diffExcerpt || "(no diff available)"}`,
                    },
                ],
            });
            const text = response.content[0]?.type === "text" ? response.content[0].text : null;
            this.trackUsage(projectId, response.usage.input_tokens, response.usage.output_tokens);
            return text;
        }
        catch (error) {
            logger_1.default.error("AI explainCommit failed", { error, projectId });
            return null;
        }
    }
    /**
     * Draft a GitHub issue (title + body) from an error group's context.
     * Returns null when AI is unavailable; callers fall back to a template.
     */
    static async draftIssueFromError(errorContext, projectId) {
        const client = this.getClient();
        if (!client || !this.checkRateLimit(projectId))
            return null;
        try {
            const response = await client.messages.create({
                model: config_1.config.anthropic.model,
                max_tokens: 1536,
                system: "You are Apperio, an observability platform. Draft a high-quality GitHub issue for this " +
                    "production error so a developer (or AI coding agent) can fix it without asking questions. " +
                    "The issue must contain: a clear title (max 80 chars, imperative, no emoji); " +
                    "a body in GitHub markdown with sections: Summary (plain English, 2-3 sentences), " +
                    "Impact (occurrences, users affected, environments, first/last seen), " +
                    "Stack trace (fenced code block, trimmed to the relevant frames), " +
                    "Possible cause (only if suspect commits are provided — reference them by short sha), " +
                    "and a final line linking back to Apperio using the provided URL. " +
                    'Return ONLY a JSON object: {"title": "...", "body": "..."}. No other text.',
                messages: [
                    {
                        role: "user",
                        content: JSON.stringify(errorContext, null, 2),
                    },
                ],
            });
            const text = response.content[0]?.type === "text" ? response.content[0].text : null;
            this.trackUsage(projectId, response.usage.input_tokens, response.usage.output_tokens);
            if (!text)
                return null;
            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
                if (typeof parsed?.title === "string" && typeof parsed?.body === "string") {
                    return { title: parsed.title, body: parsed.body };
                }
                return null;
            }
            catch {
                logger_1.default.warn("Failed to parse AI issue draft", { projectId });
                return null;
            }
        }
        catch (error) {
            logger_1.default.error("AI draftIssueFromError failed", { error, projectId });
            return null;
        }
    }
    /**
     * Rank candidate commits by likelihood of causing an error (suspect commits).
     */
    static async rankSuspectCommits(input, projectId) {
        const client = this.getClient();
        if (!client || !this.checkRateLimit(projectId))
            return null;
        try {
            const response = await client.messages.create({
                model: config_1.config.anthropic.model,
                max_tokens: 1024,
                system: "You are Apperio, an observability platform. Given an error and a list of recent commits " +
                    "(message + touched files), rank which commits most likely introduced the error. " +
                    "Score 0-100 (100 = almost certainly the cause). Only include commits with score >= 30. " +
                    "rationale: one sentence explaining the connection, phrased as a suggestion, never as blame. " +
                    "Return ONLY a JSON array of {sha, score, rationale}, highest score first, max 3 items.",
                messages: [
                    {
                        role: "user",
                        content: JSON.stringify(input, null, 2),
                    },
                ],
            });
            const text = response.content[0]?.type === "text" ? response.content[0].text : null;
            this.trackUsage(projectId, response.usage.input_tokens, response.usage.output_tokens);
            if (!text)
                return null;
            try {
                const jsonMatch = text.match(/\[[\s\S]*\]/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
                return Array.isArray(parsed)
                    ? parsed.filter((s) => s && typeof s.sha === "string" && typeof s.score === "number")
                    : null;
            }
            catch {
                return null;
            }
        }
        catch (error) {
            logger_1.default.error("AI rankSuspectCommits failed", { error, projectId });
            return null;
        }
    }
}
exports.AIService = AIService;
