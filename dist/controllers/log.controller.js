"use strict";
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
exports.createLog = void 0;
const project_model_1 = require("../models/project.model");
const log_model_1 = require("../models/log.model");
const createLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { level, message, metadata } = req.body;
        const apiKey = req.headers["x-api-key"];
        // Validate log level
        if (!Object.values(log_model_1.LogLevel).includes(level)) {
            return res.status(400).json({
                success: false,
                message: "Invalid log level",
            });
        }
        // Check if project exists
        const project = yield project_model_1.Project.findOne({ apiKey });
        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }
        const log = yield log_model_1.Log.create({
            level,
            message,
            metadata,
            project: project._id,
        });
        res.status(201).json({
            success: true,
            message: "Log created successfully",
            data: log,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to log message",
            error,
        });
    }
});
exports.createLog = createLog;
