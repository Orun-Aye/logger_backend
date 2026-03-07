import { Types } from "mongoose";
import {
  OrganizationService,
  OrgNotFoundError,
  OrgValidationError,
  OrgForbiddenError,
} from "../../services/organization.service";
import { OrganizationModel } from "../../models/organization.model";
import { createTestUser, createTestOrganization } from "../factories";

describe("OrganizationService", () => {
  let ownerId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    ownerId = user._id.toString();
  });

  // ----- createOrganization -----
  describe("createOrganization", () => {
    it("should create an organization with the owner as first member", async () => {
      const org = await OrganizationService.createOrganization(
        "My Org",
        "my-org",
        ownerId
      );

      expect(org.name).toBe("My Org");
      expect(org.slug).toBe("my-org");
      expect(org.ownerId.toString()).toBe(ownerId);
      expect(org.members.length).toBe(1);
      expect(org.members[0].role).toBe("owner");
      expect(org.members[0].user.toString()).toBe(ownerId);
    });

    it("should throw for missing name", async () => {
      await expect(
        OrganizationService.createOrganization("", "valid-slug", ownerId)
      ).rejects.toThrow(OrgValidationError);
    });

    it("should throw for missing slug", async () => {
      await expect(
        OrganizationService.createOrganization("Org Name", "", ownerId)
      ).rejects.toThrow(OrgValidationError);
    });

    it("should throw for invalid slug format", async () => {
      await expect(
        OrganizationService.createOrganization(
          "Org Name",
          "INVALID_SLUG",
          ownerId
        )
      ).rejects.toThrow(OrgValidationError);
    });

    it("should throw for duplicate slug", async () => {
      await createTestOrganization(ownerId, { slug: "unique-slug" });

      await expect(
        OrganizationService.createOrganization(
          "Another Org",
          "unique-slug",
          ownerId
        )
      ).rejects.toThrow(OrgValidationError);
    });

    it("should throw for invalid owner ID", async () => {
      await expect(
        OrganizationService.createOrganization("Org", "slug", "bad-id")
      ).rejects.toThrow(OrgValidationError);
    });
  });

  // ----- getOrganization -----
  describe("getOrganization", () => {
    it("should return an organization by ID", async () => {
      const org = await createTestOrganization(ownerId);

      const result = await OrganizationService.getOrganization(
        org._id.toString()
      );

      expect(result.name).toBe(org.name);
      expect(result.slug).toBe(org.slug);
    });

    it("should throw for non-existent org", async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(
        OrganizationService.getOrganization(fakeId)
      ).rejects.toThrow(OrgNotFoundError);
    });

    it("should throw for invalid org ID", async () => {
      await expect(
        OrganizationService.getOrganization("not-valid")
      ).rejects.toThrow(OrgValidationError);
    });
  });

  // ----- getOrganizationBySlug -----
  describe("getOrganizationBySlug", () => {
    it("should return an organization by slug", async () => {
      await createTestOrganization(ownerId, { slug: "find-by-slug" });

      const result = await OrganizationService.getOrganizationBySlug(
        "find-by-slug"
      );

      expect(result.slug).toBe("find-by-slug");
    });

    it("should throw for non-existent slug", async () => {
      await expect(
        OrganizationService.getOrganizationBySlug("no-such-slug")
      ).rejects.toThrow(OrgNotFoundError);
    });
  });

  // ----- getUserOrganizations -----
  describe("getUserOrganizations", () => {
    it("should return all organizations the user belongs to", async () => {
      await createTestOrganization(ownerId);
      await createTestOrganization(ownerId);

      const orgs = await OrganizationService.getUserOrganizations(ownerId);

      expect(orgs.length).toBe(2);
    });

    it("should return empty array for user with no orgs", async () => {
      const newUser = await createTestUser({ email: "no-orgs@example.com" });
      const orgs = await OrganizationService.getUserOrganizations(
        newUser._id.toString()
      );

      expect(orgs).toEqual([]);
    });
  });

  // ----- updateOrganization -----
  describe("updateOrganization", () => {
    it("should update organization name", async () => {
      const org = await createTestOrganization(ownerId);

      const result = await OrganizationService.updateOrganization(
        org._id.toString(),
        { name: "Updated Org Name" }
      );

      expect(result.name).toBe("Updated Org Name");
    });

    it("should throw for non-existent org", async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(
        OrganizationService.updateOrganization(fakeId, { name: "X" })
      ).rejects.toThrow(OrgNotFoundError);
    });
  });

  // ----- deleteOrganization -----
  describe("deleteOrganization", () => {
    it("should delete an organization when requested by owner", async () => {
      const org = await createTestOrganization(ownerId);

      await OrganizationService.deleteOrganization(
        org._id.toString(),
        ownerId
      );

      const deleted = await OrganizationModel.findById(org._id);
      expect(deleted).toBeNull();
    });

    it("should throw when non-owner tries to delete", async () => {
      const org = await createTestOrganization(ownerId);
      const otherUser = await createTestUser({ email: "other@example.com" });

      await expect(
        OrganizationService.deleteOrganization(
          org._id.toString(),
          otherUser._id.toString()
        )
      ).rejects.toThrow(OrgForbiddenError);
    });

    it("should throw for non-existent org", async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(
        OrganizationService.deleteOrganization(fakeId, ownerId)
      ).rejects.toThrow(OrgNotFoundError);
    });
  });

  // ----- addMember -----
  describe("addMember", () => {
    it("should add a new member to the organization", async () => {
      const org = await createTestOrganization(ownerId);
      const newMember = await createTestUser({ email: "member@example.com" });

      const result = await OrganizationService.addMember(
        org._id.toString(),
        newMember._id.toString(),
        "member"
      );

      expect(result.members.length).toBe(2);
      const added = result.members.find(
        (m: any) =>
          (m.user._id || m.user).toString() === newMember._id.toString()
      );
      expect(added).toBeDefined();
    });

    it("should throw when user is already a member", async () => {
      const org = await createTestOrganization(ownerId);

      await expect(
        OrganizationService.addMember(org._id.toString(), ownerId, "member")
      ).rejects.toThrow("User is already a member");
    });

    it("should throw when user does not exist", async () => {
      const org = await createTestOrganization(ownerId);
      const fakeUserId = new Types.ObjectId().toString();

      await expect(
        OrganizationService.addMember(
          org._id.toString(),
          fakeUserId,
          "member"
        )
      ).rejects.toThrow("User not found");
    });
  });

  // ----- removeMember -----
  describe("removeMember", () => {
    it("should remove a member from the organization", async () => {
      const org = await createTestOrganization(ownerId);
      const member = await createTestUser({ email: "removeme@example.com" });

      await OrganizationService.addMember(
        org._id.toString(),
        member._id.toString(),
        "member"
      );

      const result = await OrganizationService.removeMember(
        org._id.toString(),
        member._id.toString()
      );

      const stillExists = result.members.find(
        (m: any) =>
          (m.user._id || m.user).toString() === member._id.toString()
      );
      expect(stillExists).toBeUndefined();
    });

    it("should throw when trying to remove the owner", async () => {
      const org = await createTestOrganization(ownerId);

      await expect(
        OrganizationService.removeMember(org._id.toString(), ownerId)
      ).rejects.toThrow(OrgForbiddenError);
    });

    it("should throw when user is not a member", async () => {
      const org = await createTestOrganization(ownerId);
      const nonMember = await createTestUser({ email: "not-member@example.com" });

      await expect(
        OrganizationService.removeMember(
          org._id.toString(),
          nonMember._id.toString()
        )
      ).rejects.toThrow("User is not a member");
    });
  });

  // ----- updateMemberRole -----
  describe("updateMemberRole", () => {
    it("should update a member's role", async () => {
      const org = await createTestOrganization(ownerId);
      const member = await createTestUser({ email: "rolechange@example.com" });

      await OrganizationService.addMember(
        org._id.toString(),
        member._id.toString(),
        "member"
      );

      const result = await OrganizationService.updateMemberRole(
        org._id.toString(),
        member._id.toString(),
        "admin"
      );

      const updated = result.members.find(
        (m: any) =>
          (m.user._id || m.user).toString() === member._id.toString()
      );
      expect(updated).toBeDefined();
      expect(updated.role).toBe("admin");
    });

    it("should throw when trying to change the owner's role", async () => {
      const org = await createTestOrganization(ownerId);

      await expect(
        OrganizationService.updateMemberRole(
          org._id.toString(),
          ownerId,
          "viewer"
        )
      ).rejects.toThrow(OrgForbiddenError);
    });

    it("should throw when user is not a member", async () => {
      const org = await createTestOrganization(ownerId);
      const nonMember = await createTestUser({ email: "nothere@example.com" });

      await expect(
        OrganizationService.updateMemberRole(
          org._id.toString(),
          nonMember._id.toString(),
          "admin"
        )
      ).rejects.toThrow("User is not a member");
    });
  });
});
