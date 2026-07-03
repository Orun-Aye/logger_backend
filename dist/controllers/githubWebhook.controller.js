"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubWebhookController = void 0;
const github_webhook_service_1 = require("../services/github-webhook.service");
const github_app_service_1 = require("../services/integrations/github-app.service");
const task_queue_1 = require("../utils/task-queue");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Inbound GitHub App webhook receiver.
 *
 * Mounted with express.raw() BEFORE the global JSON body parser so the
 * HMAC signature can be verified over the exact bytes GitHub sent.
 * Acknowledges fast (202) and processes on the webhook task queue.
 */
exports.GithubWebhookController = {
    async receive(req, res) {
        if (!github_app_service_1.GithubAppService.isEnabled()) {
            return res
                .status(503)
                .json({ status: "error", message: "GitHub App is not configured" });
        }
        const signature = req.headers["x-hub-signature-256"];
        const event = req.headers["x-github-event"];
        const deliveryId = req.headers["x-github-delivery"];
        if (!event || !deliveryId) {
            return res
                .status(400)
                .json({ status: "error", message: "Missing GitHub webhook headers" });
        }
        const rawBody = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(JSON.stringify(req.body ?? {}));
        if (!github_webhook_service_1.GithubWebhookService.verifySignature(rawBody, signature)) {
            logger_1.default.warn("GithubWebhook: signature verification failed", {
                deliveryId,
                event,
            });
            return res
                .status(401)
                .json({ status: "error", message: "Invalid signature" });
        }
        let payload;
        try {
            payload = JSON.parse(rawBody.toString("utf8"));
        }
        catch {
            return res
                .status(400)
                .json({ status: "error", message: "Invalid JSON payload" });
        }
        // Idempotency: skip redeliveries
        const firstDelivery = await github_webhook_service_1.GithubWebhookService.recordDelivery(deliveryId, event).catch((error) => {
            logger_1.default.error("GithubWebhook: delivery record failed", {
                deliveryId,
                error: error instanceof Error ? error.message : String(error),
            });
            return true; // fail open — processing is idempotent per entity anyway
        });
        if (!firstDelivery) {
            return res.status(200).json({ status: "success", data: { duplicate: true } });
        }
        task_queue_1.webhookQueue.enqueue(`github:${event}:${deliveryId}`, async () => {
            try {
                await github_webhook_service_1.GithubWebhookService.processEvent(event, payload);
                await github_webhook_service_1.GithubWebhookService.markDelivery(deliveryId, "processed");
            }
            catch (error) {
                await github_webhook_service_1.GithubWebhookService.markDelivery(deliveryId, "failed", error instanceof Error ? error.message : String(error));
                throw error;
            }
        });
        return res.status(202).json({ status: "success", data: { queued: true } });
    },
};
