"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const githubWebhook_controller_1 = require("../controllers/githubWebhook.controller");
/**
 * GitHub App webhook route. No JWT/API-key auth — authentication is the
 * HMAC signature verified by the controller over the RAW body.
 *
 * IMPORTANT: this router must be mounted BEFORE the global express.json()
 * middleware in server.ts so `req.body` stays a Buffer here.
 */
const router = (0, express_1.Router)();
router.post("/github", (0, express_1.raw)({ type: "*/*", limit: "10mb" }), githubWebhook_controller_1.GithubWebhookController.receive);
exports.default = router;
