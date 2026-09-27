// Mock notification service to prevent actual emails / in-app writes
jest.mock("../../services/notification.service", () => ({
  NotificationService: {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendInApp: jest.fn().mockResolvedValue(undefined),
  },
}));

import { Types } from "mongoose";
import {
  ErrorGroupService,
  shouldNotifyForEnvironment,
} from "../../services/errorGroup.service";
import { NotificationService } from "../../services/notification.service";
import { ErrorGroupModel } from "../../models/errorGroup.model";
import { ProjectModel } from "../../models/project.model";
import { ILog } from "../../models/log.model";
import { config } from "../../config";
import { createTestUser, createTestProject, createTestLog } from "../factories";

const sendEmail = NotificationService.sendEmail as jest.Mock;
const sendInApp = NotificationService.sendInApp as jest.Mock;

describe("shouldNotifyForEnvironment", () => {
  it("defaults to production only when settings are missing", () => {
    expect(shouldNotifyForEnvironment(undefined, "production")).toBe(true);
    expect(shouldNotifyForEnvironment(undefined, "staging")).toBe(false);
    expect(shouldNotifyForEnvironment({}, "staging")).toBe(false);
  });

  it("returns false when disabled, regardless of environment", () => {
    expect(
      shouldNotifyForEnvironment({ enabled: false, environments: [] }, "production")
    ).toBe(false);
  });

  it("treats an empty environment list as all environments", () => {
    expect(
      shouldNotifyForEnvironment({ enabled: true, environments: [] }, "staging")
    ).toBe(true);
  });

  it("matches environments case-insensitively", () => {
    expect(
      shouldNotifyForEnvironment({ environments: ["production"] }, "Production")
    ).toBe(true);
  });

  it("notifies for untagged events rather than dropping them", () => {
    expect(shouldNotifyForEnvironment({ environments: ["production"] }, undefined)).toBe(true);
  });
});

describe("ErrorGroupService.recordError notifications", () => {
  let ownerId: Types.ObjectId;
  let projectId: string;
  const originalEmailEnabled = config.email.enabled;

  beforeAll(() => {
    (config.email as any).enabled = true;
  });

  afterAll(() => {
    (config.email as any).enabled = originalEmailEnabled;
  });

  beforeEach(async () => {
    sendEmail.mockClear();
    sendInApp.mockClear();
    const user = await createTestUser();
    ownerId = user._id as Types.ObjectId;
    const project = await createTestProject(ownerId);
    projectId = project._id.toString();
  });

  const recordError = async (environment: string | undefined, message = "boom") => {
    const log = await createTestLog(projectId, {
      level: "error",
      message,
      environment,
      error: { name: "TypeError", message },
    });
    await ErrorGroupService.recordError(log.toObject() as ILog);
  };

  it("emails the owner for a new production error by default", async () => {
    await recordError("production");
    expect(sendInApp).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not notify for staging errors by default", async () => {
    await recordError("staging");
    expect(sendInApp).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    // The group is still recorded
    expect(await ErrorGroupModel.countDocuments({ projectId })).toBe(1);
  });

  it("applies the production-only default to projects created before the setting existed", async () => {
    await ProjectModel.collection.updateOne(
      { _id: new Types.ObjectId(projectId) },
      { $unset: { notificationSettings: "" } }
    );
    await recordError("staging");
    expect(sendEmail).not.toHaveBeenCalled();
    await recordError("production", "other error");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not notify at all when turned off", async () => {
    await ProjectModel.updateOne(
      { _id: projectId },
      { $set: { notificationSettings: { errorGroups: { enabled: false, environments: [] } } } }
    );
    await recordError("production");
    expect(sendInApp).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("notifies once when a group first seen in staging reaches production", async () => {
    await recordError("staging");
    await recordError("staging");
    expect(sendEmail).not.toHaveBeenCalled();

    await recordError("production");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].text).toContain("(production)");

    // Further production events on the same group stay quiet
    await recordError("production");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not re-notify a group already notified when it spreads", async () => {
    await ProjectModel.updateOne(
      { _id: projectId },
      { $set: { notificationSettings: { errorGroups: { enabled: true, environments: [] } } } }
    );
    await recordError("staging");
    await recordError("production");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sends a single notification for concurrent first events", async () => {
    const logs = await Promise.all(
      [1, 2, 3].map(() =>
        createTestLog(projectId, {
          level: "error",
          message: "race",
          environment: "production",
          error: { name: "TypeError", message: "race" },
        })
      )
    );
    await Promise.all(
      logs.map((l) => ErrorGroupService.recordError(l.toObject() as ILog))
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
