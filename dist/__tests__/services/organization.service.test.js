"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const organization_service_1 = require("../../services/organization.service");
const organization_model_1 = require("../../models/organization.model");
const factories_1 = require("../factories");
describe("OrganizationService", () => {
    let ownerId;
    beforeEach(async () => {
        const user = await (0, factories_1.createTestUser)();
        ownerId = user._id.toString();
    });
    // ----- createOrganization -----
    describe("createOrganization", () => {
        it("should create an organization with the owner as first member", async () => {
            const org = await organization_service_1.OrganizationService.createOrganization("My Org", "my-org", ownerId);
            expect(org.name).toBe("My Org");
            expect(org.slug).toBe("my-org");
            expect(org.ownerId.toString()).toBe(ownerId);
            expect(org.members.length).toBe(1);
            expect(org.members[0].role).toBe("owner");
            expect(org.members[0].user.toString()).toBe(ownerId);
        });
        it("should throw for missing name", async () => {
            await expect(organization_service_1.OrganizationService.createOrganization("", "valid-slug", ownerId)).rejects.toThrow(organization_service_1.OrgValidationError);
        });
        it("should throw for missing slug", async () => {
            await expect(organization_service_1.OrganizationService.createOrganization("Org Name", "", ownerId)).rejects.toThrow(organization_service_1.OrgValidationError);
        });
        it("should throw for invalid slug format", async () => {
            await expect(organization_service_1.OrganizationService.createOrganization("Org Name", "INVALID_SLUG", ownerId)).rejects.toThrow(organization_service_1.OrgValidationError);
        });
        it("should throw for duplicate slug", async () => {
            await (0, factories_1.createTestOrganization)(ownerId, { slug: "unique-slug" });
            await expect(organization_service_1.OrganizationService.createOrganization("Another Org", "unique-slug", ownerId)).rejects.toThrow(organization_service_1.OrgValidationError);
        });
        it("should throw for invalid owner ID", async () => {
            await expect(organization_service_1.OrganizationService.createOrganization("Org", "slug", "bad-id")).rejects.toThrow(organization_service_1.OrgValidationError);
        });
    });
    // ----- getOrganization -----
    describe("getOrganization", () => {
        it("should return an organization by ID", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            const result = await organization_service_1.OrganizationService.getOrganization(org._id.toString());
            expect(result.name).toBe(org.name);
            expect(result.slug).toBe(org.slug);
        });
        it("should throw for non-existent org", async () => {
            const fakeId = new mongoose_1.Types.ObjectId().toString();
            await expect(organization_service_1.OrganizationService.getOrganization(fakeId)).rejects.toThrow(organization_service_1.OrgNotFoundError);
        });
        it("should throw for invalid org ID", async () => {
            await expect(organization_service_1.OrganizationService.getOrganization("not-valid")).rejects.toThrow(organization_service_1.OrgValidationError);
        });
    });
    // ----- getOrganizationBySlug -----
    describe("getOrganizationBySlug", () => {
        it("should return an organization by slug", async () => {
            await (0, factories_1.createTestOrganization)(ownerId, { slug: "find-by-slug" });
            const result = await organization_service_1.OrganizationService.getOrganizationBySlug("find-by-slug");
            expect(result.slug).toBe("find-by-slug");
        });
        it("should throw for non-existent slug", async () => {
            await expect(organization_service_1.OrganizationService.getOrganizationBySlug("no-such-slug")).rejects.toThrow(organization_service_1.OrgNotFoundError);
        });
    });
    // ----- getUserOrganizations -----
    describe("getUserOrganizations", () => {
        it("should return all organizations the user belongs to", async () => {
            await (0, factories_1.createTestOrganization)(ownerId);
            await (0, factories_1.createTestOrganization)(ownerId);
            const orgs = await organization_service_1.OrganizationService.getUserOrganizations(ownerId);
            expect(orgs.length).toBe(2);
        });
        it("should return empty array for user with no orgs", async () => {
            const newUser = await (0, factories_1.createTestUser)({ email: "no-orgs@example.com" });
            const orgs = await organization_service_1.OrganizationService.getUserOrganizations(newUser._id.toString());
            expect(orgs).toEqual([]);
        });
    });
    // ----- updateOrganization -----
    describe("updateOrganization", () => {
        it("should update organization name", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            const result = await organization_service_1.OrganizationService.updateOrganization(org._id.toString(), { name: "Updated Org Name" });
            expect(result.name).toBe("Updated Org Name");
        });
        it("should throw for non-existent org", async () => {
            const fakeId = new mongoose_1.Types.ObjectId().toString();
            await expect(organization_service_1.OrganizationService.updateOrganization(fakeId, { name: "X" })).rejects.toThrow(organization_service_1.OrgNotFoundError);
        });
    });
    // ----- deleteOrganization -----
    describe("deleteOrganization", () => {
        it("should delete an organization when requested by owner", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            await organization_service_1.OrganizationService.deleteOrganization(org._id.toString(), ownerId);
            const deleted = await organization_model_1.OrganizationModel.findById(org._id);
            expect(deleted).toBeNull();
        });
        it("should throw when non-owner tries to delete", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            const otherUser = await (0, factories_1.createTestUser)({ email: "other@example.com" });
            await expect(organization_service_1.OrganizationService.deleteOrganization(org._id.toString(), otherUser._id.toString())).rejects.toThrow(organization_service_1.OrgForbiddenError);
        });
        it("should throw for non-existent org", async () => {
            const fakeId = new mongoose_1.Types.ObjectId().toString();
            await expect(organization_service_1.OrganizationService.deleteOrganization(fakeId, ownerId)).rejects.toThrow(organization_service_1.OrgNotFoundError);
        });
    });
    // ----- addMember -----
    describe("addMember", () => {
        it("should add a new member to the organization", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            const newMember = await (0, factories_1.createTestUser)({ email: "member@example.com" });
            const result = await organization_service_1.OrganizationService.addMember(org._id.toString(), newMember._id.toString(), "member");
            expect(result.members.length).toBe(2);
            const added = result.members.find((m) => (m.user._id || m.user).toString() === newMember._id.toString());
            expect(added).toBeDefined();
        });
        it("should throw when user is already a member", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            await expect(organization_service_1.OrganizationService.addMember(org._id.toString(), ownerId, "member")).rejects.toThrow("User is already a member");
        });
        it("should throw when user does not exist", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            const fakeUserId = new mongoose_1.Types.ObjectId().toString();
            await expect(organization_service_1.OrganizationService.addMember(org._id.toString(), fakeUserId, "member")).rejects.toThrow("User not found");
        });
    });
    // ----- removeMember -----
    describe("removeMember", () => {
        it("should remove a member from the organization", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            const member = await (0, factories_1.createTestUser)({ email: "removeme@example.com" });
            await organization_service_1.OrganizationService.addMember(org._id.toString(), member._id.toString(), "member");
            const result = await organization_service_1.OrganizationService.removeMember(org._id.toString(), member._id.toString());
            const stillExists = result.members.find((m) => (m.user._id || m.user).toString() === member._id.toString());
            expect(stillExists).toBeUndefined();
        });
        it("should throw when trying to remove the owner", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            await expect(organization_service_1.OrganizationService.removeMember(org._id.toString(), ownerId)).rejects.toThrow(organization_service_1.OrgForbiddenError);
        });
        it("should throw when user is not a member", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            const nonMember = await (0, factories_1.createTestUser)({ email: "not-member@example.com" });
            await expect(organization_service_1.OrganizationService.removeMember(org._id.toString(), nonMember._id.toString())).rejects.toThrow("User is not a member");
        });
    });
    // ----- updateMemberRole -----
    describe("updateMemberRole", () => {
        it("should update a member's role", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            const member = await (0, factories_1.createTestUser)({ email: "rolechange@example.com" });
            await organization_service_1.OrganizationService.addMember(org._id.toString(), member._id.toString(), "member");
            const result = await organization_service_1.OrganizationService.updateMemberRole(org._id.toString(), member._id.toString(), "admin");
            const updated = result.members.find((m) => (m.user._id || m.user).toString() === member._id.toString());
            expect(updated).toBeDefined();
            expect(updated.role).toBe("admin");
        });
        it("should throw when trying to change the owner's role", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            await expect(organization_service_1.OrganizationService.updateMemberRole(org._id.toString(), ownerId, "viewer")).rejects.toThrow(organization_service_1.OrgForbiddenError);
        });
        it("should throw when user is not a member", async () => {
            const org = await (0, factories_1.createTestOrganization)(ownerId);
            const nonMember = await (0, factories_1.createTestUser)({ email: "nothere@example.com" });
            await expect(organization_service_1.OrganizationService.updateMemberRole(org._id.toString(), nonMember._id.toString(), "admin")).rejects.toThrow("User is not a member");
        });
    });
});
