"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubWebhookService = void 0;
/**
 * GithubWebhookService — verification and dispatch for inbound GitHub
 * App webhooks.
 *
 * The HTTP layer verifies the HMAC signature over the RAW request body,
 * records an idempotency document (GitHub retries deliveries), acks fast,
 * and processes the event on the webhook task queue.
 */
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("../config");
const logger_1 = __importDefault(require("../utils/logger"));
const webhookDelivery_model_1 = require("../models/webhookDelivery.model");
const github_app_service_1 = require("./integrations/github-app.service");
const change_service_1 = require("./change.service");
const deployment_service_1 = require("./deployment.service");
const errorGroup_service_1 = require("./errorGroup.service");
class GithubWebhookService {
    /** Constant-time HMAC-SHA256 verification over the raw body. */
    static verifySignature(rawBody, signatureHeader) {
        if (!config_1.config.githubApp.webhookSecret)
            return false;
        if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
            return false;
        }
        const expected = crypto_1.default
            .createHmac("sha256", config_1.config.githubApp.webhookSecret)
            .update(rawBody)
            .digest("hex");
        const provided = signatureHeader.slice("sha256=".length);
        const expectedBuf = Buffer.from(expected, "hex");
        const providedBuf = Buffer.from(provided, "hex");
        if (expectedBuf.length !== providedBuf.length)
            return false;
        return crypto_1.default.timingSafeEqual(expectedBuf, providedBuf);
    }
    /**
     * Record the delivery for idempotency. Returns false when this delivery
     * id was already seen (redelivery) and processing should be skipped.
     */
    static async recordDelivery(deliveryId, event) {
        try {
            await webhookDelivery_model_1.WebhookDeliveryModel.create({
                provider: "github",
                deliveryId,
                event,
                status: "processing",
            });
            return true;
        }
        catch (error) {
            if (error?.code === 11000)
                return false;
            throw error;
        }
    }
    static async markDelivery(deliveryId, status, errorMessage) {
        await webhookDelivery_model_1.WebhookDeliveryModel.updateOne({ provider: "github", deliveryId }, { $set: { status, error: errorMessage } }).catch(() => undefined);
    }
    /** Dispatch one verified, deduplicated event to its processors. */
    static async processEvent(event, payload) {
        switch (event) {
            case "installation":
            case "installation_repositories":
                await github_app_service_1.GithubAppService.handleInstallationEvent(payload);
                return;
            case "push":
                await change_service_1.ChangeService.handlePushEvent(payload);
                return;
            case "deployment":
            case "deployment_status":
            case "release":
            case "issues": {
                const fullName = payload?.repository?.full_name || "";
                const [owner, repo] = fullName.split("/");
                if (!owner || !repo)
                    return;
                const projects = await change_service_1.ChangeService.findProjectsForRepo(owner, repo);
                if (projects.length === 0 && event !== "issues")
                    return;
                for (const project of projects) {
                    if (event === "deployment") {
                        await deployment_service_1.DeploymentService.handleDeploymentEvent(project.projectId, payload);
                    }
                    else if (event === "deployment_status") {
                        await deployment_service_1.DeploymentService.handleDeploymentStatusEvent(project.projectId, payload);
                    }
                    else if (event === "release") {
                        await deployment_service_1.DeploymentService.handleReleaseEvent(project.projectId, payload);
                    }
                }
                if (event === "issues") {
                    // Issue sync matches by linked issue, not by project list
                    await errorGroup_service_1.ErrorGroupService.handleIssueWebhook(fullName, payload);
                }
                return;
            }
            case "ping":
                logger_1.default.info("GithubWebhook: ping received");
                return;
            default:
                logger_1.default.debug("GithubWebhook: ignoring event", { event });
        }
    }
}
exports.GithubWebhookService = GithubWebhookService;
