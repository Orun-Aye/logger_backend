"use strict";
// @ts-nocheck
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertRuleController = void 0;
const alertRule_service_1 = require("../services/alertRule.service");
class AlertRuleController {
    static create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const rule = yield alertRule_service_1.AlertRuleService.createRule(Object.assign(Object.assign({}, req.body), { projectId: req.projectId }));
                res.status(201).json({ status: "success", data: rule });
            }
            catch (err) {
                console.error("Alert rule creation error:", err); // Add logging
                // Handle specific error types
                if (err instanceof alertRule_service_1.RuleServiceError) {
                    return res.status(400).json({ status: "error", message: err.message });
                }
                if (err instanceof alertRule_service_1.ProjectNotFoundError) {
                    return res.status(404).json({ status: "error", message: err.message });
                }
                // Generic error
                res.status(500).json({
                    status: "error",
                    message: "Failed to create alert rule.",
                    details: err.message, // Include for debugging
                });
            }
        });
    }
    static getRuleByProject(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const rules = yield alertRule_service_1.AlertRuleService.getRulesByProject(req.projectId);
                res.status(200).json({ status: "success", data: rules });
            }
            catch (err) {
                res
                    .status(500)
                    .json({ status: "error", message: "Failed to fetch rules." });
            }
        });
    }
    static getRuleById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const rule = yield alertRule_service_1.AlertRuleService.getRuleById(req.params.id);
                res.status(200).json({ status: "success", data: rule });
            }
            catch (error) {
                res
                    .status(500)
                    .json({ status: "error", message: "Failed to fetch rule." });
            }
        });
    }
    static update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updated = yield alertRule_service_1.AlertRuleService.updateRule(req.params.id, req.body);
                res.status(200).json({ status: "success", data: updated });
            }
            catch (err) {
                res.status(500).json({ status: "error", message: "Update failed." });
            }
        });
    }
    static delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield alertRule_service_1.AlertRuleService.deleteRule(req.params.id);
                res.status(204).send();
            }
            catch (err) {
                res.status(500).json({ status: "error", message: "Delete failed." });
            }
        });
    }
}
exports.AlertRuleController = AlertRuleController;
