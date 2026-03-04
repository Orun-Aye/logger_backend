// src/routes/sourceMap.routes.ts

import { Router } from "express";
import { SourceMapController } from "../controllers/sourceMap.controller";
import { verifyToken, authenticateApiKey } from "../middleware/auth.middleware";
import { validate } from "../middleware/validation.middleware";
import {
  uploadSourceMapSchema,
  listSourceMapsSchema,
  resolveStackTraceSchema,
  sourceMapIdParamSchema,
  sourceMapProjectIdParamSchema,
} from "../validators/sourceMap.validator";

const router = Router();

// Upload via API key (used by CLI/build plugins)
router.post(
  "/:projectId/sourcemaps",
  authenticateApiKey,
  validate(sourceMapProjectIdParamSchema, "params"),
  validate(uploadSourceMapSchema, "body"),
  SourceMapController.upload
);

// List source maps via JWT (used by frontend dashboard)
router.get(
  "/:projectId/sourcemaps",
  verifyToken,
  validate(sourceMapProjectIdParamSchema, "params"),
  validate(listSourceMapsSchema, "query"),
  SourceMapController.list
);

// Resolve stack trace via JWT (used by frontend dashboard)
// IMPORTANT: This route MUST come BEFORE the DELETE /:projectId/sourcemaps/:id route,
// because Express would match "resolve" as an :id param otherwise.
router.post(
  "/:projectId/sourcemaps/resolve",
  verifyToken,
  validate(sourceMapProjectIdParamSchema, "params"),
  validate(resolveStackTraceSchema, "body"),
  SourceMapController.resolve
);

// Delete a source map via JWT (used by frontend dashboard)
router.delete(
  "/:projectId/sourcemaps/:id",
  verifyToken,
  SourceMapController.delete
);

export default router;
