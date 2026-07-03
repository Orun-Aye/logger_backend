import { Request, Response } from "express";
import { GithubWebhookService } from "../services/github-webhook.service";
import { GithubAppService } from "../services/integrations/github-app.service";
import { webhookQueue } from "../utils/task-queue";
import logger from "../utils/logger";

/**
 * Inbound GitHub App webhook receiver.
 *
 * Mounted with express.raw() BEFORE the global JSON body parser so the
 * HMAC signature can be verified over the exact bytes GitHub sent.
 * Acknowledges fast (202) and processes on the webhook task queue.
 */
export const GithubWebhookController = {
  async receive(req: Request, res: Response) {
    if (!GithubAppService.isEnabled()) {
      return res
        .status(503)
        .json({ status: "error", message: "GitHub App is not configured" });
    }

    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    const event = req.headers["x-github-event"] as string | undefined;
    const deliveryId = req.headers["x-github-delivery"] as string | undefined;

    if (!event || !deliveryId) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing GitHub webhook headers" });
    }

    const rawBody: Buffer = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body ?? {}));

    if (!GithubWebhookService.verifySignature(rawBody, signature)) {
      logger.warn("GithubWebhook: signature verification failed", {
        deliveryId,
        event,
      });
      return res
        .status(401)
        .json({ status: "error", message: "Invalid signature" });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res
        .status(400)
        .json({ status: "error", message: "Invalid JSON payload" });
    }

    // Idempotency: skip redeliveries
    const firstDelivery = await GithubWebhookService.recordDelivery(
      deliveryId,
      event
    ).catch((error) => {
      logger.error("GithubWebhook: delivery record failed", {
        deliveryId,
        error: error instanceof Error ? error.message : String(error),
      });
      return true; // fail open — processing is idempotent per entity anyway
    });

    if (!firstDelivery) {
      return res.status(200).json({ status: "success", data: { duplicate: true } });
    }

    webhookQueue.enqueue(`github:${event}:${deliveryId}`, async () => {
      try {
        await GithubWebhookService.processEvent(event, payload);
        await GithubWebhookService.markDelivery(deliveryId, "processed");
      } catch (error) {
        await GithubWebhookService.markDelivery(
          deliveryId,
          "failed",
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    });

    return res.status(202).json({ status: "success", data: { queued: true } });
  },
};
