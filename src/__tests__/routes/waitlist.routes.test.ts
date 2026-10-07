// The route only emails on admin invites; mocking also keeps notification.service's
// import chain (server.ts, otplib ESM) out of the test runtime.
jest.mock("../../services/notification.service", () => ({
  NotificationService: { sendEmail: jest.fn() },
}));

import express from "express";
import request from "supertest";
import waitlistRoutes from "../../routes/waitlist.routes";
import { WaitlistModel } from "../../models/waitlist.model";

const app = express();
app.use(express.json());
app.use("/api/v1/waitlist", waitlistRoutes);

const join = (email: string) =>
  request(app).post("/api/v1/waitlist").send({ email });

describe("POST /api/v1/waitlist", () => {
  it("stores every new signup while earlier ones are still pending", async () => {
    // Regression: inviteCode defaulted to null, and the unique sparse index
    // still indexes explicit nulls, so the second pending entry collided and
    // was dropped while the response claimed it was already on the list.
    const first = await join("first@example.com");
    const second = await join("second@example.com");
    const third = await join("third@example.com");

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(201);
    expect(await WaitlistModel.countDocuments()).toBe(3);
    expect(second.body.referralCode).toEqual(expect.any(String));
  });

  it("reports an existing entry with its real position", async () => {
    await join("again@example.com");
    const repeat = await join("again@example.com");

    expect(repeat.status).toBe(200);
    expect(repeat.body.message).toMatch(/already on the waitlist/i);
    expect(repeat.body.position).toBe(1);
  });

  it("never claims success for an entry it did not save", async () => {
    const spy = jest
      .spyOn(WaitlistModel, "create")
      .mockRejectedValueOnce(
        Object.assign(new Error("E11000 duplicate key"), { code: 11000 })
      );

    const res = await join("lost@example.com");

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(await WaitlistModel.countDocuments({ email: "lost@example.com" })).toBe(0);
    spy.mockRestore();
  });
});
