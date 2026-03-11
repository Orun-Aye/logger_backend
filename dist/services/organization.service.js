"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationService = exports.OrgForbiddenError = exports.OrgValidationError = exports.OrgNotFoundError = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const organization_model_1 = require("../models/organization.model");
const user_model_1 = require("../models/user.model");
// ---------- Custom Errors ----------
class OrgNotFoundError extends Error {
    constructor(message = "Organization not found") {
        super(message);
        this.name = "OrgNotFoundError";
    }
}
exports.OrgNotFoundError = OrgNotFoundError;
class OrgValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "OrgValidationError";
    }
}
exports.OrgValidationError = OrgValidationError;
class OrgForbiddenError extends Error {
    constructor(message = "You do not have permission to perform this action") {
        super(message);
        this.name = "OrgForbiddenError";
    }
}
exports.OrgForbiddenError = OrgForbiddenError;
// ---------- Service ----------
class OrganizationService {
    /**
     * Create a new organization. The creator becomes the owner and first member.
     */
    static async createOrganization(name, slug, ownerId) {
        try {
            if (!name || !slug) {
                throw new OrgValidationError("Name and slug are required");
            }
            if (!mongoose_1.default.Types.ObjectId.isValid(ownerId)) {
                throw new OrgValidationError("Invalid owner ID");
            }
            // Validate slug format (lowercase, alphanumeric, hyphens only)
            const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
            if (!slugRegex.test(slug)) {
                throw new OrgValidationError("Slug must be lowercase alphanumeric with hyphens only");
            }
            // Check for duplicate slug
            const existing = await organization_model_1.OrganizationModel.findOne({ slug }).lean();
            if (existing) {
                throw new OrgValidationError("An organization with this slug already exists");
            }
            const org = new organization_model_1.OrganizationModel({
                name,
                slug,
                ownerId: new mongoose_1.default.Types.ObjectId(ownerId),
                members: [
                    {
                        user: new mongoose_1.default.Types.ObjectId(ownerId),
                        role: "owner",
                        joinedAt: new Date(),
                    },
                ],
            });
            const saved = await org.save();
            return saved;
        }
        catch (error) {
            if (error instanceof OrgValidationError ||
                error instanceof OrgNotFoundError) {
                throw error;
            }
            // Handle MongoDB duplicate key error
            if (error.code === 11000) {
                throw new OrgValidationError("An organization with this slug already exists");
            }
            throw new Error(`Failed to create organization: ${error}`);
        }
    }
    /**
     * Get an organization by ID with populated member user data.
     */
    static async getOrganization(orgId) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new OrgValidationError("Invalid organization ID");
            }
            const org = await organization_model_1.OrganizationModel.findById(orgId)
                .populate("members.user", "email firstName lastName avatarUrl")
                .populate("ownerId", "email firstName lastName avatarUrl")
                .lean();
            if (!org) {
                throw new OrgNotFoundError();
            }
            return org;
        }
        catch (error) {
            if (error instanceof OrgNotFoundError ||
                error instanceof OrgValidationError) {
                throw error;
            }
            throw new Error(`Failed to get organization: ${error}`);
        }
    }
    /**
     * Get an organization by slug.
     */
    static async getOrganizationBySlug(slug) {
        try {
            if (!slug) {
                throw new OrgValidationError("Slug is required");
            }
            const org = await organization_model_1.OrganizationModel.findOne({ slug })
                .populate("members.user", "email firstName lastName avatarUrl")
                .populate("ownerId", "email firstName lastName avatarUrl")
                .lean();
            if (!org) {
                throw new OrgNotFoundError();
            }
            return org;
        }
        catch (error) {
            if (error instanceof OrgNotFoundError ||
                error instanceof OrgValidationError) {
                throw error;
            }
            throw new Error(`Failed to get organization by slug: ${error}`);
        }
    }
    /**
     * Get all organizations the user belongs to.
     */
    static async getUserOrganizations(userId) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw new OrgValidationError("Invalid user ID");
            }
            const orgs = await organization_model_1.OrganizationModel.find({
                "members.user": new mongoose_1.default.Types.ObjectId(userId),
            })
                .populate("members.user", "email firstName lastName avatarUrl")
                .populate("ownerId", "email firstName lastName avatarUrl")
                .sort({ createdAt: -1 })
                .lean();
            return orgs;
        }
        catch (error) {
            if (error instanceof OrgValidationError) {
                throw error;
            }
            throw new Error(`Failed to get user organizations: ${error}`);
        }
    }
    /**
     * Update organization fields (name, billingEmail, settings, plan).
     */
    static async updateOrganization(orgId, updates) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new OrgValidationError("Invalid organization ID");
            }
            const org = await organization_model_1.OrganizationModel.findByIdAndUpdate(orgId, { $set: updates }, { new: true, runValidators: true })
                .populate("members.user", "email firstName lastName avatarUrl")
                .lean();
            if (!org) {
                throw new OrgNotFoundError();
            }
            return org;
        }
        catch (error) {
            if (error instanceof OrgNotFoundError ||
                error instanceof OrgValidationError) {
                throw error;
            }
            throw new Error(`Failed to update organization: ${error}`);
        }
    }
    /**
     * Delete organization. Only the owner can delete.
     */
    static async deleteOrganization(orgId, requestingUserId) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new OrgValidationError("Invalid organization ID");
            }
            const org = await organization_model_1.OrganizationModel.findById(orgId).lean();
            if (!org) {
                throw new OrgNotFoundError();
            }
            if (org.ownerId.toString() !== requestingUserId) {
                throw new OrgForbiddenError("Only the organization owner can delete the organization");
            }
            await organization_model_1.OrganizationModel.findByIdAndDelete(orgId);
        }
        catch (error) {
            if (error instanceof OrgNotFoundError ||
                error instanceof OrgValidationError ||
                error instanceof OrgForbiddenError) {
                throw error;
            }
            throw new Error(`Failed to delete organization: ${error}`);
        }
    }
    /**
     * Add a member to the organization.
     */
    static async addMember(orgId, userId, role = "member") {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new OrgValidationError("Invalid organization ID");
            }
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw new OrgValidationError("Invalid user ID");
            }
            const org = await organization_model_1.OrganizationModel.findById(orgId);
            if (!org) {
                throw new OrgNotFoundError();
            }
            // Check if user is already a member
            const existingMember = org.members.find((m) => m.user.toString() === userId);
            if (existingMember) {
                throw new OrgValidationError("User is already a member of this organization");
            }
            // Verify the user exists
            const user = await user_model_1.UserModel.findById(userId).lean();
            if (!user) {
                throw new OrgValidationError("User not found");
            }
            org.members.push({
                user: new mongoose_1.default.Types.ObjectId(userId),
                role,
                joinedAt: new Date(),
            });
            await org.save();
            return await this.getOrganization(orgId);
        }
        catch (error) {
            if (error instanceof OrgNotFoundError ||
                error instanceof OrgValidationError) {
                throw error;
            }
            throw new Error(`Failed to add member: ${error}`);
        }
    }
    /**
     * Remove a member from the organization. Cannot remove the owner.
     */
    static async removeMember(orgId, userId) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new OrgValidationError("Invalid organization ID");
            }
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw new OrgValidationError("Invalid user ID");
            }
            const org = await organization_model_1.OrganizationModel.findById(orgId);
            if (!org) {
                throw new OrgNotFoundError();
            }
            // Prevent removing the owner
            if (org.ownerId.toString() === userId) {
                throw new OrgForbiddenError("Cannot remove the organization owner. Transfer ownership first.");
            }
            const memberIndex = org.members.findIndex((m) => m.user.toString() === userId);
            if (memberIndex === -1) {
                throw new OrgValidationError("User is not a member of this organization");
            }
            org.members.splice(memberIndex, 1);
            await org.save();
            return await this.getOrganization(orgId);
        }
        catch (error) {
            if (error instanceof OrgNotFoundError ||
                error instanceof OrgValidationError ||
                error instanceof OrgForbiddenError) {
                throw error;
            }
            throw new Error(`Failed to remove member: ${error}`);
        }
    }
    /**
     * Update a member's role. Cannot change the owner's role.
     */
    static async updateMemberRole(orgId, userId, newRole) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new OrgValidationError("Invalid organization ID");
            }
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw new OrgValidationError("Invalid user ID");
            }
            const org = await organization_model_1.OrganizationModel.findById(orgId);
            if (!org) {
                throw new OrgNotFoundError();
            }
            // Prevent changing the owner's role
            if (org.ownerId.toString() === userId) {
                throw new OrgForbiddenError("Cannot change the owner's role");
            }
            const member = org.members.find((m) => m.user.toString() === userId);
            if (!member) {
                throw new OrgValidationError("User is not a member of this organization");
            }
            member.role = newRole;
            await org.save();
            return await this.getOrganization(orgId);
        }
        catch (error) {
            if (error instanceof OrgNotFoundError ||
                error instanceof OrgValidationError ||
                error instanceof OrgForbiddenError) {
                throw error;
            }
            throw new Error(`Failed to update member role: ${error}`);
        }
    }
    /**
     * Create an invite for a user by email. The user is added as a pending
     * member with `invitedAt` set and no `joinedAt`.
     */
    static async createInvite(orgId, email, role = "member") {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new OrgValidationError("Invalid organization ID");
            }
            if (!email || typeof email !== "string") {
                throw new OrgValidationError("Email is required");
            }
            const org = await organization_model_1.OrganizationModel.findById(orgId);
            if (!org) {
                throw new OrgNotFoundError();
            }
            // Look up user by email
            const user = await user_model_1.UserModel.findOne({
                email: email.toLowerCase().trim(),
            }).lean();
            if (!user) {
                throw new OrgValidationError("No user found with that email. They must sign up first.");
            }
            // Check if already a member
            const existingMember = org.members.find((m) => m.user.toString() === user._id.toString());
            if (existingMember) {
                throw new OrgValidationError("User is already a member or has a pending invite");
            }
            org.members.push({
                user: user._id,
                role,
                invitedAt: new Date(),
            });
            await org.save();
            return await this.getOrganization(orgId);
        }
        catch (error) {
            if (error instanceof OrgNotFoundError ||
                error instanceof OrgValidationError) {
                throw error;
            }
            throw new Error(`Failed to create invite: ${error}`);
        }
    }
    /**
     * Accept an invite. Sets joinedAt on the member record.
     */
    static async acceptInvite(orgId, userId) {
        try {
            if (!mongoose_1.default.Types.ObjectId.isValid(orgId)) {
                throw new OrgValidationError("Invalid organization ID");
            }
            if (!mongoose_1.default.Types.ObjectId.isValid(userId)) {
                throw new OrgValidationError("Invalid user ID");
            }
            const org = await organization_model_1.OrganizationModel.findById(orgId);
            if (!org) {
                throw new OrgNotFoundError();
            }
            const member = org.members.find((m) => m.user.toString() === userId);
            if (!member) {
                throw new OrgValidationError("No pending invite found for this user");
            }
            if (member.joinedAt) {
                throw new OrgValidationError("Invite has already been accepted");
            }
            member.joinedAt = new Date();
            await org.save();
            return await this.getOrganization(orgId);
        }
        catch (error) {
            if (error instanceof OrgNotFoundError ||
                error instanceof OrgValidationError) {
                throw error;
            }
            throw new Error(`Failed to accept invite: ${error}`);
        }
    }
}
exports.OrganizationService = OrganizationService;
