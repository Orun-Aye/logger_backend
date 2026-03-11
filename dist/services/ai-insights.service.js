"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIInsightsService = void 0;
const ai_service_1 = require("../utils/ai/ai.service");
const insights_service_1 = require("./insights.service");
const anomaly_service_1 = require("./anomaly.service");
const aiSuggestion_service_1 = require("./aiSuggestion.service");
const log_model_1 = require("../models/log.model");
/**
 * AIInsightsService — Orchestration layer that merges heuristic + AI-powered insights.
 * Always returns a result (gracefully degrades when AI is unavailable).
 */
class AIInsightsService {
    /**
     * Get root cause analysis for an error group
     */
    static async getRootCause(projectId, errorId) {
        // Fetch the error and surrounding logs
        const errorLog = await log_model_1.LogModel.findById(errorId).lean();
        if (!errorLog) {
            return {
                analysis: "Error log not found.",
                source: "heuristic",
                confidence: "low",
            };
        }
        // Fetch similar errors (same message pattern)
        const similarErrors = await log_model_1.LogModel.find({
            projectId,
            level: { $in: ["error", "fatal"] },
            "error.message": errorLog.error?.message
                ? { $regex: errorLog.error.message.slice(0, 50).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") }
                : undefined,
            createdAt: {
                $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        const errorMessages = similarErrors.map((e) => `[${e.service || "unknown"}] ${e.error?.name || ""}: ${e.error?.message || e.message}`);
        // Try AI analysis first
        const aiAnalysis = await ai_service_1.AIService.analyzeErrorGroup(errorMessages, {
            projectId,
            service: errorLog.service,
            environment: errorLog.environment,
        });
        if (aiAnalysis) {
            return {
                analysis: aiAnalysis,
                source: "ai",
                confidence: similarErrors.length > 5 ? "high" : "medium",
            };
        }
        // Heuristic fallback: correlate by common fields
        const services = [...new Set(similarErrors.map((e) => e.service).filter(Boolean))];
        const urls = [...new Set(similarErrors.map((e) => e.url).filter(Boolean))];
        const envs = [...new Set(similarErrors.map((e) => e.environment).filter(Boolean))];
        const parts = [];
        parts.push(`Found ${similarErrors.length} similar errors in the last 24 hours.`);
        if (services.length > 0)
            parts.push(`Affected services: ${services.join(", ")}.`);
        if (urls.length > 0)
            parts.push(`Common URLs: ${urls.slice(0, 3).join(", ")}.`);
        if (envs.length > 0)
            parts.push(`Environments: ${envs.join(", ")}.`);
        return {
            analysis: parts.join(" "),
            source: "heuristic",
            confidence: similarErrors.length > 10 ? "medium" : "low",
        };
    }
    /**
     * Answer a natural language question about the project
     */
    static async askQuestion(projectId, question) {
        // Build project context (last 24h summary)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [summary] = await log_model_1.LogModel.aggregate([
            { $match: { projectId, createdAt: { $gte: oneDayAgo } } },
            {
                $group: {
                    _id: null,
                    totalLogs: { $sum: 1 },
                    errorCount: {
                        $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] },
                    },
                    services: { $addToSet: "$service" },
                    environments: { $addToSet: "$environment" },
                    avgResponseTime: { $avg: "$data.network.duration" },
                },
            },
        ]);
        const context = {
            timeRange: "last 24 hours",
            totalLogs: summary?.totalLogs || 0,
            errorCount: summary?.errorCount || 0,
            errorRate: summary?.totalLogs
                ? ((summary.errorCount / summary.totalLogs) * 100).toFixed(2) + "%"
                : "0%",
            services: summary?.services?.filter(Boolean) || [],
            environments: summary?.environments?.filter(Boolean) || [],
            avgResponseTime: summary?.avgResponseTime
                ? Math.round(summary.avgResponseTime) + "ms"
                : "N/A",
        };
        // Try AI answer
        const aiAnswer = await ai_service_1.AIService.answerQuestion(question, context, projectId);
        if (aiAnswer) {
            return { answer: aiAnswer, source: "ai" };
        }
        // Heuristic fallback
        return {
            answer: `In the last 24 hours: ${context.totalLogs} logs, ${context.errorCount} errors (${context.errorRate} error rate), avg response time ${context.avgResponseTime}. Services: ${context.services.join(", ") || "none"}. For more detailed analysis, ensure ANTHROPIC_ENABLED=true.`,
            source: "heuristic",
        };
    }
    /**
     * Get enriched insights (statistical + AI summary + anomalies)
     */
    static async getEnrichedInsights(projectId, options = {}) {
        // Get base statistical insights
        const insights = await insights_service_1.DashboardInsightsService.getProjectInsights(projectId, { range: "24h" });
        // Get anomaly count
        const anomalyStats = await anomaly_service_1.AnomalyService.getAnomalyStats(projectId);
        const anomalyCount = anomalyStats.openCritical + anomalyStats.openWarnings + anomalyStats.openInfo;
        // Try AI summary
        const aiSummary = await ai_service_1.AIService.generateInsightSummary({
            summary: insights.summary,
            logCountBySeverity: insights.logCountBySeverity,
            errorAnalysis: insights.errorAnalysis,
            anomalyCount,
        }, projectId);
        return {
            insights,
            aiSummary,
            anomalyCount,
            source: aiSummary ? "ai" : "heuristic",
        };
    }
    /**
     * Get optimization suggestions (heuristic + AI-powered)
     */
    static async getOptimizationSuggestions(projectId) {
        // Get heuristic suggestions
        const heuristicSuggestions = await aiSuggestion_service_1.AISuggestionService.suggestAlertRules(projectId);
        const formattedHeuristic = (heuristicSuggestions || []).map((s) => ({
            title: s.title || s.pattern || "Suggestion",
            description: s.description || s.recommendation || "",
            priority: s.severity || s.priority || "medium",
            source: "heuristic",
        }));
        // Try AI suggestions
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [perfData] = await log_model_1.LogModel.aggregate([
            { $match: { projectId, createdAt: { $gte: oneDayAgo } } },
            {
                $group: {
                    _id: null,
                    totalLogs: { $sum: 1 },
                    errorCount: {
                        $sum: { $cond: [{ $in: ["$level", ["error", "fatal"]] }, 1, 0] },
                    },
                    avgResponseTime: { $avg: "$data.network.duration" },
                    topErrors: {
                        $push: {
                            $cond: [
                                { $in: ["$level", ["error", "fatal"]] },
                                "$error.message",
                                "$$REMOVE",
                            ],
                        },
                    },
                },
            },
        ]);
        const aiSuggestions = await ai_service_1.AIService.suggestOptimizations({
            totalLogs: perfData?.totalLogs || 0,
            errorCount: perfData?.errorCount || 0,
            errorRate: perfData?.totalLogs
                ? ((perfData.errorCount / perfData.totalLogs) * 100).toFixed(2)
                : "0",
            avgResponseTime: perfData?.avgResponseTime || 0,
            topErrors: (perfData?.topErrors || []).slice(0, 10),
        }, projectId);
        const formattedAi = (aiSuggestions || []).map((s) => ({
            ...s,
            source: "ai",
        }));
        return {
            suggestions: [...formattedAi, ...formattedHeuristic],
        };
    }
}
exports.AIInsightsService = AIInsightsService;
