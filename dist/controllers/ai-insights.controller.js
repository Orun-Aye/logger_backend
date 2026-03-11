"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIInsightsController = void 0;
const ai_insights_service_1 = require("../services/ai-insights.service");
const ai_insights_validator_1 = require("../validators/ai-insights.validator");
class AIInsightsController {
    /**
     * GET /insights/:projectId/root-cause/:errorId
     */
    static async getRootCause(req, res) {
        try {
            const { projectId, errorId } = req.params;
            const data = await ai_insights_service_1.AIInsightsService.getRootCause(projectId, errorId);
            return res.status(200).json({
                status: "success",
                message: "Root cause analysis complete",
                data,
                meta: { projectId, errorId },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    /**
     * POST /insights/:projectId/ask
     */
    static async askQuestion(req, res) {
        try {
            const { projectId } = req.params;
            const parsed = ai_insights_validator_1.askQuestionSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    status: "error",
                    message: "Invalid request body",
                    errors: parsed.error.flatten().fieldErrors,
                });
            }
            const data = await ai_insights_service_1.AIInsightsService.askQuestion(projectId, parsed.data.question);
            return res.status(200).json({
                status: "success",
                message: "Question answered",
                data,
                meta: { projectId },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    /**
     * GET /insights/:projectId/suggestions
     */
    static async getOptimizationSuggestions(req, res) {
        try {
            const { projectId } = req.params;
            const data = await ai_insights_service_1.AIInsightsService.getOptimizationSuggestions(projectId);
            return res.status(200).json({
                status: "success",
                message: "Optimization suggestions generated",
                data: data.suggestions,
                meta: { projectId },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    /**
     * GET /insights/:projectId/enriched
     */
    static async getEnrichedInsights(req, res) {
        try {
            const { projectId } = req.params;
            const parsed = ai_insights_validator_1.enrichedInsightsQuerySchema.safeParse(req.query);
            const timeRange = parsed.success ? parsed.data.timeRange : undefined;
            const data = await ai_insights_service_1.AIInsightsService.getEnrichedInsights(projectId, {
                timeRange,
            });
            return res.status(200).json({
                status: "success",
                message: "Enriched insights generated",
                data,
                meta: { projectId },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
}
exports.AIInsightsController = AIInsightsController;
