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
exports.authenticateApiKey = authenticateApiKey;
const project_model_1 = require("../models/project.model");
function authenticateApiKey(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const apiKey = req.headers['X-API-Key'];
        if (!apiKey) {
            return res.status(401).json({
                status: 'error',
                code: 'UNAUTHORIZED',
                message: 'API key is required'
            });
        }
        const project = yield project_model_1.ProjectModel.findOne({ apiKey });
        if (!project) {
            return res.status(403).json({
                status: 'error',
                code: 'INVALID_API_KEY',
                message: 'The provided API key is invalid.'
            });
        }
        req.projectId = (_a = project._id) === null || _a === void 0 ? void 0 : _a.toString(); // Attach project ID to request for later use
        next();
    });
}
