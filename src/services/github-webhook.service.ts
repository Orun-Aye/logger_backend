/**
 * GithubWebhookService — verification and dispatch for inbound GitHub
 * App webhooks.
 *
 * The HTTP layer verifies the HMAC signature over the RAW request body,
 * records an idempotency document (GitHub retries deliveries), acks fast,
 * and processes the event on the webhook task queue.
 */
import crypto from "crypto";
import { config } from "../config";
import logger from "../utils/logger";
import { WebhookDeliveryModel } from "../models/webhookDelivery.model";
import { GithubAppService } from "./integrations/github-app.service";
import { ChangeService } from "./change.service";
import { DeploymentService } from "./deployment.service";
import { ErrorGroupService } from "./errorGroup.service";

export class GithubWebhookService {
  /** Constant-time HMAC-SHA256 verification over the raw body. */
  static verifySignature(rawBody: Buffer, signatureHeader?: string): boolean {
    if (!config.githubApp.webhookSecret) return false;
    if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
      return false;
    }
    const expected = crypto
      .createHmac("sha256", config.githubApp.webhookSecret)
      .update(rawBody)
      .digest("hex");
    const provided = signatureHeader.slice("sha256=".length);

    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(provided, "hex");
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  }

  /**
   * Record the delivery for idempotency. Returns false when this delivery
   * id was already seen (redelivery) and processing should be skipped.
   */
  static async recordDelivery(
    deliveryId: string,
    event: string
  ): Promise<boolean> {
    try {
      await WebhookDeliveryModel.create({
        provider: "github",
        deliveryId,
        event,
        status: "processing",
      });
      return true;
    } catch (error: any) {
      if (error?.code === 11000) return false;
      throw error;
    }
  }

  static async markDelivery(
    deliveryId: string,
    status: "processed" | "failed" | "skipped",
    errorMessage?: string
  ): Promise<void> {
    await WebhookDeliveryModel.updateOne(
      { provider: "github", deliveryId },
      { $set: { status, error: errorMessage } }
    ).catch(() => undefined);
  }

  /** Dispatch one verified, deduplicated event to its processors. */
  static async processEvent(event: string, payload: any): Promise<void> {
    switch (event) {
      case "installation":
      case "installation_repositories":
        await GithubAppService.handleInstallationEvent(payload);
        return;

      case "push":
        await ChangeService.handlePushEvent(payload);
        return;

      case "deployment":
      case "deployment_status":
      case "release":
      case "issues": {
        const fullName: string = payload?.repository?.full_name || "";
        const [owner, repo] = fullName.split("/");
        if (!owner || !repo) return;
        const projects = await ChangeService.findProjectsForRepo(owner, repo);
        if (projects.length === 0 && event !== "issues") return;

        for (const project of projects) {
          if (event === "deployment") {
            await DeploymentService.handleDeploymentEvent(
              project.projectId,
              payload
            );
          } else if (event === "deployment_status") {
            await DeploymentService.handleDeploymentStatusEvent(
              project.projectId,
              payload
            );
          } else if (event === "release") {
            await DeploymentService.handleReleaseEvent(
              project.projectId,
              payload
            );
          }
        }

        if (event === "issues") {
          // Issue sync matches by linked issue, not by project list
          await ErrorGroupService.handleIssueWebhook(fullName, payload);
        }
        return;
      }

      case "ping":
        logger.info("GithubWebhook: ping received");
        return;

      default:
        logger.debug("GithubWebhook: ignoring event", { event });
    }
  }
}
