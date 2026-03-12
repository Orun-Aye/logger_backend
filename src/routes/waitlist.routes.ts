import { Router, Request, Response } from "express";
import { WaitlistModel } from "../models/waitlist.model";
import crypto from "crypto";

const router = Router();

// POST /api/v1/waitlist — join the waitlist (public, no auth)
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

export default router;
