// Mock notification service to avoid the deep import chain
// (notification.service -> server -> user.routes -> mfa.controller -> otplib ESM)
jest.mock("../../services/notification.service", () => ({
  NotificationService: {
    sendEmail: jest.fn().mockResolvedValue(undefined),
    sendSlack: jest.fn().mockResolvedValue(undefined),
    sendWebhook: jest.fn().mockResolvedValue(undefined),
  },
}));

import { UserService, UserNotFoundError, UserValidationError } from "../../services/user.service";
import { UserModel } from "../../models/user.model";
import { WaitlistModel } from "../../models/waitlist.model";
import { CreateUserDTO } from "../../dtos/user.dto";
import { createTestUser, createTestInvite, getTestPassword } from "../factories";
import bcrypt from "bcrypt";

describe("UserService", () => {
  // ----- createUser -----
  describe("createUser", () => {
    // Signup is invite-only during early access: each test gets a fresh code
    let inviteCode: string;

    beforeEach(async () => {
      const invite = await createTestInvite();
      inviteCode = invite.inviteCode!;
    });

    it("should create a new user and return token", async () => {
      const result = await UserService.createUser({
        email: "newuser@example.com",
        firstName: "Jane",
        lastName: "Doe",
        password: "SecurePass123!",
        role: "developer",
        inviteCode,
      });

      expect(result).toHaveProperty("_id");
      expect(result).toHaveProperty("token");
      expect(result.email).toBe("newuser@example.com");
      expect(result.firstName).toBe("Jane");
      expect(result.lastName).toBe("Doe");
      expect(result.role).toBe("developer");
      // Password should NOT be in the returned object
      expect((result as any).password).toBeUndefined();
    });

    it("should mark the invite code as used", async () => {
      await UserService.createUser({
        email: "invitee@example.com",
        firstName: "In",
        lastName: "Vitee",
        password: "SecurePass123!",
        role: "developer",
        inviteCode,
      });

      const entry = await WaitlistModel.findOne({ inviteCode });
      expect(entry!.signedUpAt).toBeInstanceOf(Date);
    });

    it("should hash the password before saving", async () => {
      await UserService.createUser({
        email: "hash-test@example.com",
        firstName: "Hash",
        lastName: "Test",
        password: "PlainTextPassword",
        role: "developer",
        inviteCode,
      });

      const user = await UserModel.findOne({ email: "hash-test@example.com" });
      expect(user).not.toBeNull();
      expect(user!.password).not.toBe("PlainTextPassword");
      const isMatch = await bcrypt.compare("PlainTextPassword", user!.password);
      expect(isMatch).toBe(true);
    });

    it("should throw if email already exists", async () => {
      await createTestUser({ email: "duplicate@example.com" });

      await expect(
        UserService.createUser({
          email: "duplicate@example.com",
          firstName: "Dup",
          lastName: "User",
          password: "SomePassword123!",
          role: "developer",
          inviteCode,
        })
      ).rejects.toThrow("User with this email already exists");
    });

    it("should require an invite code", async () => {
      await expect(
        UserService.createUser({
          email: "no-invite@example.com",
          firstName: "No",
          lastName: "Invite",
          password: "SomePassword123!",
          role: "developer",
        })
      ).rejects.toThrow("An invite code is required");
    });

    it("should reject an unknown invite code", async () => {
      await expect(
        UserService.createUser({
          email: "bad-invite@example.com",
          firstName: "Bad",
          lastName: "Invite",
          password: "SomePassword123!",
          role: "developer",
          inviteCode: "not-a-real-code",
        })
      ).rejects.toThrow("Invalid or expired invite code.");
    });

    it("should reject an invite code that is not approved", async () => {
      const pending = await createTestInvite({ status: "pending" });
      await expect(
        UserService.createUser({
          email: "pending-invite@example.com",
          firstName: "Pending",
          lastName: "Invite",
          password: "SomePassword123!",
          role: "developer",
          inviteCode: pending.inviteCode!,
        })
      ).rejects.toThrow("Invalid or expired invite code.");
    });

    it("should reject an invite code that was already used", async () => {
      await UserService.createUser({
        email: "first@example.com",
        firstName: "First",
        lastName: "User",
        password: "SomePassword123!",
        role: "developer",
        inviteCode,
      });

      await expect(
        UserService.createUser({
          email: "second@example.com",
          firstName: "Second",
          lastName: "User",
          password: "SomePassword123!",
          role: "developer",
          inviteCode,
        })
      ).rejects.toThrow("This invite code has already been used.");
    });

    it("should throw validation error for missing email", async () => {
      await expect(
        UserService.createUser({
          email: "",
          firstName: "No",
          lastName: "Email",
          password: "SomePassword123!",
          role: "developer",
        })
      ).rejects.toThrow(UserValidationError);
    });

    it("should throw validation error for missing password", async () => {
      await expect(
        UserService.createUser({
          email: "valid@example.com",
          firstName: "No",
          lastName: "Password",
          password: "",
          role: "developer",
        })
      ).rejects.toThrow(UserValidationError);
    });

    it("should throw validation error for missing names", async () => {
      await expect(
        UserService.createUser({
          email: "valid@example.com",
          firstName: "",
          lastName: "Name",
          password: "SomePass123!",
          role: "developer",
        })
      ).rejects.toThrow(UserValidationError);
    });

    it("should default role to developer if not specified", async () => {
      // role is typed as required but the service defaults it; omit it here
      const result = await UserService.createUser({
        email: "default-role@example.com",
        firstName: "Default",
        lastName: "Role",
        password: "SomePass123!",
        inviteCode,
      } as CreateUserDTO);

      expect(result.role).toBe("developer");
    });

    it("should give every new signup the full product", async () => {
      const result = await UserService.createUser({
        email: "full-tier@example.com",
        firstName: "Full",
        lastName: "Access",
        password: "SomePass123!",
        role: "developer",
        inviteCode,
      });

      expect(result.betaTier).toBe("full");
      const stored = await UserModel.findById(result._id).lean();
      expect(stored?.betaTier).toBe("full");
    });
  });

  // ----- loginUser -----
  describe("loginUser", () => {
    it("should login with valid credentials and return token", async () => {
      await createTestUser({ email: "login@example.com" });

      const result = await UserService.loginUser({
        email: "login@example.com",
        password: getTestPassword(),
      });

      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("_id");
      expect((result as any).email).toBe("login@example.com");
    });

    it("should reject a non-existent user with the same error as a wrong password", async () => {
      // No distinct "user not found": that would let callers enumerate accounts
      const login = UserService.loginUser({
        email: "noone@example.com",
        password: "whatever",
      });
      await expect(login).rejects.toThrow(UserValidationError);
      await expect(login).rejects.toThrow("Invalid email or password");
    });

    it("should throw for wrong password", async () => {
      await createTestUser({ email: "wrongpass@example.com" });

      await expect(
        UserService.loginUser({
          email: "wrongpass@example.com",
          password: "WrongPassword!",
        })
      ).rejects.toThrow(UserValidationError);
    });

    it("should throw validation error for missing email", async () => {
      await expect(
        UserService.loginUser({
          email: "",
          password: "whatever",
        })
      ).rejects.toThrow(UserValidationError);
    });

    it("should throw validation error for missing password", async () => {
      await expect(
        UserService.loginUser({
          email: "valid@example.com",
          password: "",
        })
      ).rejects.toThrow(UserValidationError);
    });
  });

  // ----- getProfile -----
  describe("getProfile", () => {
    it("should return user profile without sensitive fields", async () => {
      const user = await createTestUser({ email: "profile@example.com" });

      const profile = await UserService.getProfile(user._id.toString());

      expect(profile.email).toBe("profile@example.com");
      expect(profile.firstName).toBe("Test");
      expect((profile as any).password).toBeUndefined();
    });

    it("should throw UserNotFoundError for invalid userId", async () => {
      const fakeId = new (await import("mongoose")).Types.ObjectId().toString();
      await expect(UserService.getProfile(fakeId)).rejects.toThrow(
        UserNotFoundError
      );
    });
  });

  // ----- updateProfile -----
  describe("updateProfile", () => {
    it("should update user profile fields", async () => {
      const user = await createTestUser({ email: "update@example.com" });

      const updated = await UserService.updateProfile(user._id.toString(), {
        firstName: "Updated",
        lastName: "Name",
      });

      expect(updated.firstName).toBe("Updated");
      expect(updated.lastName).toBe("Name");
    });

    it("should throw UserNotFoundError for non-existent user", async () => {
      const fakeId = new (await import("mongoose")).Types.ObjectId().toString();
      await expect(
        UserService.updateProfile(fakeId, { firstName: "X" })
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  // ----- changePassword -----
  describe("changePassword", () => {
    it("should change password when current password is correct", async () => {
      const user = await createTestUser({ email: "changepass@example.com" });

      const result = await UserService.changePassword(
        user._id.toString(),
        getTestPassword(),
        "NewSecurePassword123!"
      );

      expect(result.message).toBe("Password changed successfully");

      // Verify new password works
      const updatedUser = await UserModel.findById(user._id);
      const isMatch = await bcrypt.compare(
        "NewSecurePassword123!",
        updatedUser!.password
      );
      expect(isMatch).toBe(true);
    });

    it("should throw when current password is incorrect", async () => {
      const user = await createTestUser({ email: "badcurrent@example.com" });

      await expect(
        UserService.changePassword(
          user._id.toString(),
          "WrongCurrent!",
          "NewPass123!"
        )
      ).rejects.toThrow(UserValidationError);
    });

    it("should throw for non-existent user", async () => {
      const fakeId = new (await import("mongoose")).Types.ObjectId().toString();
      await expect(
        UserService.changePassword(fakeId, "old", "new")
      ).rejects.toThrow(UserNotFoundError);
    });
  });
});
