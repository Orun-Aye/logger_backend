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
exports.createProject = void 0;
const nanoid_1 = require("nanoid");
const project_model_1 = require("../models/project.model");
const createProject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description } = req.body;
        const project = yield project_model_1.ProjectModel.create({
            name,
            apiKey: (0, nanoid_1.nanoid)(32),
            description,
        });
        res.status(201).json({
            message: "Project created successfully",
            data: project,
        });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to create project", error });
    }
});
exports.createProject = createProject;
