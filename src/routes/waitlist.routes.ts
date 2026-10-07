import { Router, Request, Response } from "express";
import { WaitlistModel, WaitlistStatus } from "../models/waitlist.model";
import { verifyToken } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/adminAuth.middleware";
import { NotificationService } from "../services/notification.service";
import logger from "../utils/logger";
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
      // Only a genuine same-email race is "already on the list". Any other
      // duplicate key means the entry was not saved, so say so.
      if (existing) {
        return res.status(200).json({
          status: "success",
          message: "You're already on the waitlist!",
          position: existing.position,
          referralCode: existing.referralCode,
        });
      }
    }

    logger.error("Waitlist signup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
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
        message: "Entry approved. Use /send-invite to email the invite code.",
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

// ─── Shared: Build invite email HTML ────────────────────────────────────────

function buildInviteEmailHtml(inviteCode: string, signupUrl: string): string {
  const year = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#030711;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#060b14;">

    <!-- Header -->
    <div style="padding:40px 32px 24px;text-align:center;border-bottom:1px solid #111c2e;">
      <div style="display:inline-block;margin-bottom:12px;">
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 20L4 16L8 12L12 18L18 8L22 14L24 10" stroke="#00d97e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="4" cy="20" r="2" fill="#00d97e"/><circle cx="24" cy="10" r="2" fill="#00d97e"/>
        </svg>
      </div>
      <h1 style="color:#00d97e;font-size:24px;font-weight:700;margin:0 0 2px;letter-spacing:-0.02em;">Apperio</h1>
      <p style="color:#4e6484;font-size:12px;margin:0;text-transform:uppercase;letter-spacing:1.5px;">Early Access</p>
    </div>

    <!-- Body -->
    <div style="padding:32px;">

      <!-- Welcome -->
      <h2 style="color:#e8f0fe;font-size:22px;font-weight:600;margin:0 0 16px;">Thank you for signing up.</h2>
      <p style="color:#8da4c4;font-size:14px;line-height:1.7;margin:0 0 28px;">
        We're excited to have you on board. Your early access to Apperio is confirmed.
        Use the code below to create your account and start uncovering what's happening inside your applications.
      </p>

      <!-- Invite Code Box -->
      <div style="background:#0b1220;border:1px solid #1a2640;border-radius:10px;padding:24px;text-align:center;margin:0 0 28px;">
        <p style="color:#4e6484;font-size:11px;margin:0 0 10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Your invite code</p>
        <p style="color:#00d97e;font-size:32px;font-weight:700;font-family:'Courier New',monospace;margin:0;letter-spacing:3px;">${inviteCode}</p>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:0 0 32px;">
        <a href="${signupUrl}" style="display:inline-block;background:#00d97e;color:#060b14;font-weight:700;font-size:15px;padding:14px 40px;border-radius:8px;text-decoration:none;letter-spacing:-0.01em;">
          Create Your Account &rarr;
        </a>
      </div>

      <!-- Divider -->
      <div style="border-top:1px solid #111c2e;margin:0 0 28px;"></div>

      <!-- What you get -->
      <p style="color:#e8f0fe;font-size:14px;font-weight:600;margin:0 0 12px;">What you get with early access:</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 28px;" role="presentation">
        <tr>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;vertical-align:top;width:24px;">
            <span style="color:#00d97e;">&#10003;</span>
          </td>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;">Real-time log monitoring and error tracking</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;vertical-align:top;">
            <span style="color:#00d97e;">&#10003;</span>
          </td>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;">Performance metrics and interactive dashboards</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;vertical-align:top;">
            <span style="color:#00d97e;">&#10003;</span>
          </td>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;">Alert rules with Slack, email, and webhook notifications</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;vertical-align:top;">
            <span style="color:#00d97e;">&#10003;</span>
          </td>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;">Auto-instrumentation SDK -- one line of code to get started</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;vertical-align:top;">
            <span style="color:#00d97e;">&#10003;</span>
          </td>
          <td style="padding:6px 0;color:#8da4c4;font-size:13px;line-height:1.6;">Team collaboration and project management</td>
        </tr>
      </table>

      <!-- Divider -->
      <div style="border-top:1px solid #111c2e;margin:0 0 28px;"></div>

      <!-- Feedback Section -->
      <div style="background:#0b1220;border:1px solid #1a2640;border-radius:10px;padding:24px;margin:0 0 28px;">
        <p style="color:#e8f0fe;font-size:14px;font-weight:600;margin:0 0 8px;">Your feedback shapes Apperio</p>
        <p style="color:#8da4c4;font-size:13px;line-height:1.7;margin:0 0 16px;">
          As an early access user, your input matters. If you spot a bug, have a feature idea, or just want to share how things are going,
          I'd genuinely love to hear from you. Reply directly to this email and it'll land in my inbox.
        </p>
        <p style="color:#4e6484;font-size:12px;margin:0;">
          -- Femi, building Apperio
        </p>
      </div>

      <!-- Code note -->
      <p style="color:#4e6484;font-size:12px;line-height:1.5;margin:0;text-align:center;">
        This code is unique to you and can only be used once.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #111c2e;text-align:center;">
      <p style="color:#4e6484;font-size:11px;margin:0;">&copy; ${year} Apperio. All rights reserved.</p>
    </div>

  </div>
</body>
</html>`;
}

function buildInviteEmailText(inviteCode: string, signupUrl: string): string {
  return [
    "Thank you for signing up.",
    "",
    "Your early access to Apperio is confirmed. Use the code below to create your account and start monitoring your applications.",
    "",
    `Invite code: ${inviteCode}`,
    "",
    `Sign up here: ${signupUrl}`,
    "",
    "What you get with early access:",
    "- Real-time log monitoring and error tracking",
    "- Performance metrics and interactive dashboards",
    "- Alert rules (Slack, email, webhook notifications)",
    "- Auto-instrumentation SDK (one line of code)",
    "- Team collaboration and project management",
    "",
    "Your feedback shapes Apperio. If you spot a bug, have a feature idea, or just want to share how things are going, reply to this email -- it goes straight to my inbox.",
    "",
    "-- Femi, building Apperio",
    "",
    "This code is unique to you and can only be used once.",
  ].join("\n");
}

async function sendInviteEmail(email: string, inviteCode: string): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || "https://www.apperio.dev";
  const signupUrl = `${frontendUrl}/signup?code=${inviteCode}`;

  await NotificationService.sendEmail({
    to: [email],
    subject: "You're in -- your Apperio early access code",
    html: buildInviteEmailHtml(inviteCode, signupUrl),
    text: buildInviteEmailText(inviteCode, signupUrl),
    replyTo: "femi@apperio.dev",
  });
}

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

      await sendInviteEmail(entry.email, entry.inviteCode);

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
