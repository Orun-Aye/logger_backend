"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.favoriteProjectSchema = void 0;
const zod_1 = require("zod");
const objectIdRegex = /^[0-9a-fA-F]{24}$/;
exports.favoriteProjectSchema = zod_1.z.object({
    projectId: zod_1.z.string().regex(objectIdRegex, "Invalid project ID format"),
});
