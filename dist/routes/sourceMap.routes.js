"use strict";
// src/routes/sourceMap.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sourceMap_controller_1 = require("../controllers/sourceMap.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const sourceMap_validator_1 = require("../validators/sourceMap.validator");
const router = (0, express_1.Router)();
// Upload via API key (used by CLI/build plugins)
router.post("/:projectId/sourcemaps", auth_middleware_1.authenticateApiKey, (0, validation_middleware_1.validate)(sourceMap_validator_1.sourceMapProjectIdParamSchema, "params"), (0, validation_middleware_1.validate)(sourceMap_validator_1.uploadSourceMapSchema, "body"), sourceMap_controller_1.SourceMapController.upload);
// List source maps via JWT (used by frontend dashboard)
router.get("/:projectId/sourcemaps", auth_middleware_1.verifyToken, (0, validation_middleware_1.validate)(sourceMap_validator_1.sourceMapProjectIdParamSchema, "params"), (0, validation_middleware_1.validate)(sourceMap_validator_1.listSourceMapsSchema, "query"), sourceMap_controller_1.SourceMapController.list);
// Resolve stack trace via JWT (used by frontend dashboard)
// IMPORTANT: This route MUST come BEFORE the DELETE /:projectId/sourcemaps/:id route,
// because Express would match "resolve" as an :id param otherwise.
router.post("/:projectId/sourcemaps/resolve", auth_middleware_1.verifyToken, (0, validation_middleware_1.validate)(sourceMap_validator_1.sourceMapProjectIdParamSchema, "params"), (0, validation_middleware_1.validate)(sourceMap_validator_1.resolveStackTraceSchema, "body"), sourceMap_controller_1.SourceMapController.resolve);
// Delete a source map via JWT (used by frontend dashboard)
router.delete("/:projectId/sourcemaps/:id", auth_middleware_1.verifyToken, sourceMap_controller_1.SourceMapController.delete);
exports.default = router;
