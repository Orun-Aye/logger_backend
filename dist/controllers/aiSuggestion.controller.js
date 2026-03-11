"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AISuggestionController = void 0;
const aiSuggestion_service_1 = require("../services/aiSuggestion.service");
class AISuggestionController {
    static async getSuggestions(req, res) {
        try {
            const { projectId } = req.params;
            const limit = parseInt(req.query.limit) || 10;
            const data = await aiSuggestion_service_1.AISuggestionService.suggestAlertRules(projectId, { limit });
            return res.status(200).json({
                status: "success",
                message: "Alert rule suggestions generated",
                data,
                meta: { projectId, count: data.length, method: "rule-based" },
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
    static async acceptSuggestion(req, res) {
        try {
            const { projectId } = req.params;
            const data = await aiSuggestion_service_1.AISuggestionService.acceptSuggestion(projectId, req.userId, req.body);
            return res.status(201).json({
                status: "success",
                message: "Alert rule created from suggestion",
                data,
            });
        }
        catch (error) {
            return res.status(500).json({ status: "error", message: error.message });
        }
    }
}
exports.AISuggestionController = AISuggestionController;
