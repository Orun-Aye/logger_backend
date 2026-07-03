import { Router, raw } from "express";
import { GithubWebhookController } from "../controllers/githubWebhook.controller";

/**
 * GitHub App webhook route. No JWT/API-key auth — authentication is the
 * HMAC signature verified by the controller over the RAW body.
 *
 * IMPORTANT: this router must be mounted BEFORE the global express.json()
 * middleware in server.ts so `req.body` stays a Buffer here.
 */
const router = Router();

router.post(
  "/github",
  raw({ type: "*/*", limit: "10mb" }),
  GithubWebhookController.receive
);

export default router;
