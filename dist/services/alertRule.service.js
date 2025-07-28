"use strict";
// src/services/alertRule.service.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.AlertRuleService = exports.ProjectNotFoundError = exports.RuleServiceError = exports.RuleNotFoundError = void 0;
const alertRule_model_1 = require("../models/alertRule.model");
const mongoose_1 = require("mongoose");
class RuleNotFoundError extends Error {
    constructor(id) {
        super(`AlertRule with Project/ID: ${id} not found`);
        this.name = "AlertRuleNotFoundError";
    }
}
exports.RuleNotFoundError = RuleNotFoundError;
class RuleServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = "AlertServiceError";
    }
}
exports.RuleServiceError = RuleServiceError;
class ProjectNotFoundError extends Error {
    constructor(projectId) {
        super(`Project with ID: ${projectId} not found or invalid`);
        this.name = "ProjectNotFoundError";
    }
}
exports.ProjectNotFoundError = ProjectNotFoundError;
class AlertRuleService {
    /**
     * Validates if a projectId exists in the system
     * This method should be implemented based on your project management setup
     */
    static validateProjectId(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Option 1: If you have a Project model
                // import { ProjectModel } from "../models/project.model";
                // const project = await ProjectModel.findById(projectId);
                // return !!project;
                // Option 3: Check if projectId exists in logs (assuming projects are created when first log is sent)
                // import { LogModel } from "../models/log.model";
                // const logExists = await LogModel.findOne({ projectId });
                // return !!logExists;
                // Option 4: Simple ObjectId validation (basic check)
                if (!mongoose_1.Types.ObjectId.isValid(projectId)) {
                    return false;
                }
                // For demonstration, I'll use Option 3 - checking against existing logs
                // Replace this with your actual project validation logic
                const { LogModel } = yield Promise.resolve().then(() => __importStar(require("../models/log.model")));
                const projectExists = yield LogModel.findOne({ projectId })
                    .select("_id")
                    .lean();
                return !!projectExists;
            }
            catch (error) {
                console.error("Error validating project ID:", error);
                return false;
            }
        });
    }
    static createRule(data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. First validate the projectId format
                if (!mongoose_1.Types.ObjectId.isValid(data.projectId)) {
                    throw new RuleServiceError("Invalid Project ID format");
                }
                // 2. Check if the project exists
                const isValidProject = yield this.validateProjectId(data.projectId);
                if (!isValidProject) {
                    throw new ProjectNotFoundError(data.projectId);
                }
                // 3. Check for existing rule with same name in the project
                const existingRule = yield alertRule_model_1.AlertRuleModel.findOne({
                    projectId: data.projectId,
                    name: data.name,
                });
                if (existingRule) {
                    throw new RuleServiceError("Alert Rule with the same name already set for this project.");
                }
                // 4. Create the new rule
                const newRule = yield alertRule_model_1.AlertRuleModel.create(Object.assign(Object.assign({}, data), { timestamp: new Date() }));
                return newRule;
            }
            catch (error) {
                if (error instanceof RuleNotFoundError ||
                    error instanceof RuleServiceError ||
                    error instanceof ProjectNotFoundError) {
                    throw error;
                }
                throw new Error(`Failed to create alert rule: ${error}`);
            }
        });
    }
    static getRulesByProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Validate projectId format
                if (!mongoose_1.Types.ObjectId.isValid(projectId)) {
                    throw new RuleServiceError("Invalid Project ID format");
                }
                // Validate project exists
                const isValidProject = yield this.validateProjectId(projectId);
                if (!isValidProject) {
                    throw new ProjectNotFoundError(projectId);
                }
                const rules = yield alertRule_model_1.AlertRuleModel.find({ projectId });
                if (!rules) {
                    throw new RuleNotFoundError(projectId);
                }
                return rules;
            }
            catch (error) {
                if (error instanceof RuleNotFoundError ||
                    error instanceof RuleServiceError ||
                    error instanceof ProjectNotFoundError) {
                    throw error;
                }
                throw new Error(`Failed to get rules: ${error}`);
            }
        });
    }
    static getRuleById(ruleId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!mongoose_1.Types.ObjectId.isValid(ruleId)) {
                    throw new RuleServiceError("Invalid Rule ID");
                }
                const rule = yield alertRule_model_1.AlertRuleModel.findById(ruleId).select("-__v").lean();
                if (!rule) {
                    throw new RuleNotFoundError(ruleId);
                }
                return rule;
            }
            catch (error) {
                if (error instanceof RuleNotFoundError ||
                    error instanceof RuleServiceError ||
                    error instanceof ProjectNotFoundError) {
                    throw error;
                }
                throw new Error(`Failed to get rule: ${error}`);
            }
        });
    }
    static updateRule(ruleId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const existingRule = yield alertRule_model_1.AlertRuleModel.findById(ruleId);
                if (!existingRule) {
                    throw new RuleNotFoundError(ruleId);
                }
                // If projectId is being updated, validate the new projectId
                if (data.projectId && data.projectId !== existingRule.projectId) {
                    if (!mongoose_1.Types.ObjectId.isValid(data.projectId)) {
                        throw new RuleServiceError("Invalid Project ID format");
                    }
                    const isValidProject = yield this.validateProjectId(data.projectId);
                    if (!isValidProject) {
                        throw new ProjectNotFoundError(data.projectId);
                    }
                }
                const updatedRule = yield alertRule_model_1.AlertRuleModel.findByIdAndUpdate(ruleId, data, {
                    new: true,
                    runValidators: true,
                    select: "-__v",
                }).lean();
                return updatedRule;
            }
            catch (error) {
                if (error instanceof RuleNotFoundError ||
                    error instanceof RuleServiceError ||
                    error instanceof ProjectNotFoundError) {
                    throw error;
                }
                throw new Error(`Failed to update rule: ${error}`);
            }
        });
    }
    static deleteRule(ruleId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const deletedRule = yield alertRule_model_1.AlertRuleModel.findByIdAndDelete(ruleId);
                if (!deletedRule) {
                    throw new RuleNotFoundError(ruleId);
                }
                return { success: true, deletedId: ruleId };
            }
            catch (error) {
                if (error instanceof RuleNotFoundError ||
                    error instanceof RuleServiceError ||
                    error instanceof ProjectNotFoundError) {
                    throw error;
                }
                throw new Error(`Failed to delete rule: ${error}`);
            }
        });
    }
}
exports.AlertRuleService = AlertRuleService;
