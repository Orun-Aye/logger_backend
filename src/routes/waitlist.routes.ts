import { Router, Request, Response } from "express";
import { WaitlistModel, WaitlistStatus } from "../models/waitlist.model";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/adminAuth.middleware";
import { NotificationService } from "../services/notification.service";
import crypto from "crypto";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `APER-${code}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***.***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

// ─── Public: Join waitlist ───────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({
        status: "error",
        message: "Email is required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: "error",
        message: "Please enter a valid email address.",
      });
    }

    // Check for duplicate
    const existing = await WaitlistModel.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existing) {
      return res.status(200).json({
        status: "success",
        message: "You're already on the waitlist!",
        position: existing.position,
        referralCode: existing.referralCode,
      });
    }

    // Get next position
    const count = await WaitlistModel.countDocuments();
    const position = count + 1;

    // Generate referral code
    const referralCode = crypto.randomBytes(6).toString("hex");

    const entry = await WaitlistModel.create({
      email: email.toLowerCase().trim(),
      position,
      referralCode,
    });

    return res.status(201).json({
      status: "success",
      message: "Welcome to the waitlist!",
      position: entry.position,
      referralCode: entry.referralCode,
    });
  } catch (error: unknown) {
    // Handle duplicate key error (race condition)
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      const existing = await WaitlistModel.findOne({
        email: req.body.email?.toLowerCase?.()?.trim?.(),
      });
      return res.status(200).json({
        status: "success",
        message: "You're already on the waitlist!",
        position: existing?.position || 0,
        referralCode: existing?.referralCode || "",
      });
    }

    return res.status(500).json({
      status: "error",
      message: "Failed to join waitlist. Please try again.",
    });
  }
});

// ─── Public: Validate invite code ────────────────────────────────────────────

router.get(
  "/validate-invite/:code",
  async (req: Request, res: Response) => {
    try {
      const { code } = req.params;

      const entry = await WaitlistModel.findOne({ inviteCode: code });

      if (!entry) {
        return res.status(200).json({
          status: "success",
          valid: false,
          reason: "Invalid invite code.",
        });
      }

      if (entry.status !== "approved") {
        return res.status(200).json({
          status: "success",
          valid: false,
          reason: "This invite code is no longer active.",
        });
      }

      if (entry.signedUpAt) {
        return res.status(200).json({
          status: "success",
          valid: false,
          reason: "This invite code has already been used.",
        });
      }

      return res.status(200).json({
        status: "success",
        valid: true,
        email: maskEmail(entry.email),
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to validate invite code.",
      });
    }
  }
);

// ─── Admin: List waitlist entries ────────────────────────────────────────────

router.get(
  "/",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const {
        status,
        search,
        page = "1",
        limit = "50",
        sort = "-createdAt",
      } = req.query;

      const filter: Record<string, unknown> = {};

      if (status && typeof status === "string") {
        filter.status = status as WaitlistStatus;
      }

      if (search && typeof search === "string") {
        filter.email = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      }

      const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const [entries, total] = await Promise.all([
        WaitlistModel.find(filter)
          .sort(sort as string)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        WaitlistModel.countDocuments(filter),
      ]);

      return res.status(200).json({
        status: "success",
        data: entries,
        meta: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to list waitlist entries.",
      });
    }
  }
);

// ─── Admin: Waitlist stats ───────────────────────────────────────────────────

router.get(
  "/stats",
  verifyToken,
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const [pending, approved, rejected, signedUp, total] = await Promise.all([
        WaitlistModel.countDocuments({ status: "pending" }),
        WaitlistModel.countDocuments({ status: "approved" }),
        WaitlistModel.countDocuments({ status: "rejected" }),
        WaitlistModel.countDocuments({ signedUpAt: { $ne: null } }),
        WaitlistModel.countDocuments(),
      ]);

      return res.status(200).json({
        status: "success",
        data: { pending, approved, rejected, signedUp, total },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to get waitlist stats.",
      });
    }
  }
);

// ─── Admin: Approve entry ────────────────────────────────────────────────────

router.put(
  "/:id/approve",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const entry = await WaitlistModel.findById(req.params.id);
      if (!entry) {
        return res.status(404).json({
          status: "error",
          message: "Waitlist entry not found.",
        });
      }

      if (entry.status === "approved" && entry.inviteCode) {
        return res.status(200).json({
          status: "success",
          message: "Already approved.",
          data: {
            email: entry.email,
            inviteCode: entry.inviteCode,
            approvedAt: entry.approvedAt,
          },
        });
      }

      entry.status = "approved";
      entry.inviteCode = generateInviteCode();
      entry.approvedAt = new Date();
      await entry.save();

      return res.status(200).json({
        status: "success",
        message: "Entry approved. Invite code generated.",
        data: {
          email: entry.email,
          inviteCode: entry.inviteCode,
          approvedAt: entry.approvedAt,
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to approve waitlist entry.",
      });
    }
  }
);

// ─── Admin: Reject entry ─────────────────────────────────────────────────────

router.put(
  "/:id/reject",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const entry = await WaitlistModel.findByIdAndUpdate(
        req.params.id,
        { status: "rejected" },
        { new: true }
      );

      if (!entry) {
        return res.status(404).json({
          status: "error",
          message: "Waitlist entry not found.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Entry rejected.",
        data: { email: entry.email, status: entry.status },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to reject waitlist entry.",
      });
    }
  }
);

// ─── Admin: Bulk approve ─────────────────────────────────────────────────────

router.post(
  "/bulk-approve",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "ids array is required.",
        });
      }

      const entries = await WaitlistModel.find({
        _id: { $in: ids },
        status: { $ne: "approved" },
      });

      const results: Array<{ email: string; inviteCode: string }> = [];

      for (const entry of entries) {
        entry.status = "approved";
        entry.inviteCode = generateInviteCode();
        entry.approvedAt = new Date();
        await entry.save();
        results.push({ email: entry.email, inviteCode: entry.inviteCode });
      }

      return res.status(200).json({
        status: "success",
        message: `${results.length} entries approved.`,
        data: results,
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to bulk approve entries.",
      });
    }
  }
);

// ─── Admin: Send invite email ────────────────────────────────────────────────

router.post(
  "/:id/send-invite",
  verifyToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const entry = await WaitlistModel.findById(req.params.id);

      if (!entry) {
        return res.status(404).json({
          status: "error",
          message: "Waitlist entry not found.",
        });
      }

      if (entry.status !== "approved" || !entry.inviteCode) {
        return res.status(400).json({
          status: "error",
          message: "Entry must be approved before sending an invite.",
        });
      }

      const frontendUrl = process.env.FRONTEND_URL || "https://loghive.vercel.app";
      const signupUrl = `${frontendUrl}/signup?code=${entry.inviteCode}`;

      await NotificationService.sendEmail({
        to: [entry.email],
        subject: "You're in. Your Apperio early access code.",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; background: #060b14; border-radius: 12px; overflow: hidden;">
            <div style="padding: 32px 32px 24px; text-align: center;">
              <h1 style="color: #00d97e; font-size: 28px; margin: 0 0 4px;">Apperio</h1>
              <p style="color: #8b95a5; font-size: 13px; margin: 0;">Observability Platform</p>
            </div>
            <div style="padding: 0 32px 32px;">
              <h2 style="color: #e2e8f0; font-size: 20px; margin: 0 0 12px;">You're in.</h2>
              <p style="color: #8b95a5; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Your early access spot is confirmed. Use the invite code below to create your account and start monitoring your apps.
              </p>
              <div style="background: #111c2e; border: 1px solid #1e293b; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
                <p style="color: #8b95a5; font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1px;">Your invite code</p>
                <p style="color: #00d97e; font-size: 28px; font-weight: 700; font-family: 'Courier New', monospace; margin: 0; letter-spacing: 2px;">${entry.inviteCode}</p>
              </div>
              <div style="text-align: center; margin: 0 0 24px;">
                <a href="${signupUrl}" style="display: inline-block; background: #00d97e; color: #060b14; font-weight: 600; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">
                  Create Your Account
                </a>
              </div>
              <p style="color: #8b95a5; font-size: 13px; line-height: 1.6; margin: 0 0 16px;">
                <strong style="color: #e2e8f0;">What you get with early access:</strong>
              </p>
              <ul style="color: #8b95a5; font-size: 13px; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
                <li>Real-time log monitoring and error tracking</li>
                <li>Performance metrics and dashboards</li>
                <li>Alert rules with Slack, email, and webhook notifications</li>
                <li>Auto-instrumentation SDK (one line of code)</li>
                <li>Team collaboration and project management</li>
              </ul>
              <p style="color: #475569; font-size: 12px; line-height: 1.5; margin: 0;">
                This code is unique to you. It can only be used once.
              </p>
            </div>
            <div style="padding: 16px 32px; border-top: 1px solid #1e293b;">
              <p style="color: #475569; font-size: 11px; margin: 0; text-align: center;">
                &copy; ${new Date().getFullYear()} Apperio. All rights reserved.
              </p>
            </div>
          </div>
        `,
        text: `You're in.\n\nYour Apperio early access spot is confirmed.\n\nInvite code: ${entry.inviteCode}\n\nSign up here: ${signupUrl}\n\nWhat you get:\n- Real-time log monitoring and error tracking\n- Performance metrics and dashboards\n- Alert rules (Slack, email, webhook)\n- Auto-instrumentation SDK\n- Team collaboration\n\nThis code is unique to you and can only be used once.\n\n— Apperio`,
      });

      entry.invitedAt = new Date();
      await entry.save();

      return res.status(200).json({
        status: "success",
        message: "Invite email sent.",
        data: {
          email: entry.email,
          inviteCode: entry.inviteCode,
          invitedAt: entry.invitedAt,
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Failed to send invite email.",
      });
    }
  }
);

export default router;
