"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const project_service_1 = require("../../services/project.service");
const project_model_1 = require("../../models/project.model");
const factories_1 = require("../factories");
describe("ProjectService", () => {
    let userId;
    beforeEach(async () => {
        const user = await (0, factories_1.createTestUser)();
        userId = user._id.toString();
    });
    // ----- createProject -----
    describe("createProject", () => {
        it("should create a project with valid data", async () => {
            const result = await project_service_1.ProjectService.createProject({
                name: "My New Project",
                description: "A test project",
                ownerId: userId,
            });
            expect(result).toHaveProperty("id");
            expect(result.name).toBe("My New Project");
            expect(result.description).toBe("A test project");
            expect(result).toHaveProperty("apiKey");
            expect(result.isActive).toBe(true);
        });
        it("should generate a unique API key", async () => {
            const result1 = await project_service_1.ProjectService.createProject({
                name: "Project A",
                ownerId: userId,
            });
            const result2 = await project_service_1.ProjectService.createProject({
                name: "Project B",
                ownerId: userId,
            });
            expect(result1.apiKey).not.toBe(result2.apiKey);
        });
        it("should throw validation error for empty name", async () => {
            await expect(project_service_1.ProjectService.createProject({ name: "", ownerId: userId })).rejects.toThrow(project_service_1.ProjectValidationError);
        });
        it("should throw validation error for name exceeding 100 chars", async () => {
            const longName = "a".repeat(101);
            await expect(project_service_1.ProjectService.createProject({ name: longName, ownerId: userId })).rejects.toThrow(project_service_1.ProjectValidationError);
        });
        it("should throw for duplicate project name", async () => {
            await project_service_1.ProjectService.createProject({
                name: "Unique Name",
                ownerId: userId,
            });
            await expect(project_service_1.ProjectService.createProject({
                name: "Unique Name",
                ownerId: userId,
            })).rejects.toThrow("Project with this name already exists");
        });
        it("should add the owner as admin team member", async () => {
            const result = await project_service_1.ProjectService.createProject({
                name: "Team Project",
                ownerId: userId,
            });
            const project = await project_model_1.ProjectModel.findById(result.id);
            expect(project.teamMembers).toHaveLength(1);
            expect(project.teamMembers[0].user.toString()).toBe(userId);
            expect(project.teamMembers[0].role).toBe("admin");
        });
    });
    // ----- getProjectById -----
    describe("getProjectById", () => {
        it("should return a project by its ID", async () => {
            const project = await (0, factories_1.createTestProject)(userId);
            const result = await project_service_1.ProjectService.getProjectById(project._id.toString(), { includeAnalytics: false });
            expect(result.project).toBeDefined();
            expect(result.project.name).toBe(project.name);
        });
        it("should throw ProjectNotFoundError for non-existent ID", async () => {
            const fakeId = new mongoose_1.Types.ObjectId().toString();
            await expect(project_service_1.ProjectService.getProjectById(fakeId, { includeAnalytics: false })).rejects.toThrow(project_service_1.ProjectNotFoundError);
        });
        it("should throw ProjectValidationError for invalid ID format", async () => {
            await expect(project_service_1.ProjectService.getProjectById("not-a-valid-id", {
                includeAnalytics: false,
            })).rejects.toThrow(project_service_1.ProjectValidationError);
        });
    });
    // ----- getProjectsByUser -----
    describe("getProjectsByUser", () => {
        it("should return projects owned by the user", async () => {
            await (0, factories_1.createTestProject)(userId, { name: "User Project 1" });
            await (0, factories_1.createTestProject)(userId, { name: "User Project 2" });
            const result = await project_service_1.ProjectService.getProjectsByUser(userId, {
                includeMetrics: false,
            });
            expect(result.projects.length).toBe(2);
        });
        it("should return empty array for user with no projects", async () => {
            const anotherUser = await (0, factories_1.createTestUser)({ email: "empty@example.com" });
            const result = await project_service_1.ProjectService.getProjectsByUser(anotherUser._id.toString(), { includeMetrics: false });
            expect(result.projects.length).toBe(0);
        });
        it("should throw for invalid user ID format", async () => {
            await expect(project_service_1.ProjectService.getProjectsByUser("bad-id", { includeMetrics: false })).rejects.toThrow(project_service_1.ProjectValidationError);
        });
    });
    // ----- updateProject -----
    describe("updateProject", () => {
        it("should update project name and description", async () => {
            const project = await (0, factories_1.createTestProject)(userId);
            const result = await project_service_1.ProjectService.updateProject(project._id.toString(), {
                name: "Updated Name",
                description: "Updated description",
            });
            expect(result.name).toBe("Updated Name");
            expect(result.description).toBe("Updated description");
        });
        it("should throw ProjectNotFoundError for non-existent project", async () => {
            const fakeId = new mongoose_1.Types.ObjectId().toString();
            await expect(project_service_1.ProjectService.updateProject(fakeId, { name: "X" })).rejects.toThrow(project_service_1.ProjectNotFoundError);
        });
    });
    // ----- deleteProject -----
    describe("deleteProject", () => {
        it("should soft delete a project by default (set isActive to false)", async () => {
            const project = await (0, factories_1.createTestProject)(userId);
            await project_service_1.ProjectService.deleteProject(project._id.toString());
            const deletedProject = await project_model_1.ProjectModel.findById(project._id);
            expect(deletedProject.isActive).toBe(false);
        });
        it("should hard delete when softDelete is false", async () => {
            const project = await (0, factories_1.createTestProject)(userId);
            await project_service_1.ProjectService.deleteProject(project._id.toString(), false);
            const deletedProject = await project_model_1.ProjectModel.findById(project._id);
            expect(deletedProject).toBeNull();
        });
        it("should throw for non-existent project", async () => {
            const fakeId = new mongoose_1.Types.ObjectId().toString();
            await expect(project_service_1.ProjectService.deleteProject(fakeId)).rejects.toThrow(project_service_1.ProjectNotFoundError);
        });
    });
    // ----- regenerateApiKey -----
    describe("regenerateApiKey", () => {
        it("should generate a new API key different from the old one", async () => {
            const project = await (0, factories_1.createTestProject)(userId);
            const oldApiKey = project.apiKey;
            const result = await project_service_1.ProjectService.regenerateApiKey(project._id.toString());
            expect(result.apiKey).toBeDefined();
            expect(result.apiKey).not.toBe(oldApiKey);
        });
        it("should throw for non-existent project", async () => {
            const fakeId = new mongoose_1.Types.ObjectId().toString();
            await expect(project_service_1.ProjectService.regenerateApiKey(fakeId)).rejects.toThrow(project_service_1.ProjectNotFoundError);
        });
    });
    // ----- Team Member Management -----
    describe("addTeamMember", () => {
        it("should add a team member to the project", async () => {
            const project = await (0, factories_1.createTestProject)(userId);
            const member = await (0, factories_1.createTestUser)({ email: "member@example.com" });
            const result = await project_service_1.ProjectService.addTeamMember(project._id.toString(), member._id.toString(), "viewer");
            // addTeamMember returns { projectId, teamMember, totalMembers }
            expect(result.totalMembers).toBeGreaterThanOrEqual(2);
            expect(result.teamMember.userId).toBe(member._id.toString());
            expect(result.teamMember.role).toBe("viewer");
        });
        it("should throw for duplicate team member", async () => {
            const project = await (0, factories_1.createTestProject)(userId);
            const member = await (0, factories_1.createTestUser)({ email: "dup-member@example.com" });
            const pid = project._id.toString();
            const mid = member._id.toString();
            await project_service_1.ProjectService.addTeamMember(pid, mid, "viewer");
            await expect(project_service_1.ProjectService.addTeamMember(pid, mid, "admin")).rejects.toThrow();
        });
    });
    describe("removeTeamMember", () => {
        it("should remove a team member from the project", async () => {
            const project = await (0, factories_1.createTestProject)(userId);
            const member = await (0, factories_1.createTestUser)({ email: "removable@example.com" });
            const pid = project._id.toString();
            const mid = member._id.toString();
            await project_service_1.ProjectService.addTeamMember(pid, mid, "viewer");
            const result = await project_service_1.ProjectService.removeTeamMember(pid, mid);
            // removeTeamMember returns { projectId, removedUserId, totalMembers }
            expect(result.removedUserId).toBe(mid);
            expect(result.totalMembers).toBe(1); // only owner remains
        });
    });
    describe("updateTeamMemberRole", () => {
        it("should update a team member's role", async () => {
            const project = await (0, factories_1.createTestProject)(userId);
            const member = await (0, factories_1.createTestUser)({ email: "role-update@example.com" });
            const pid = project._id.toString();
            const mid = member._id.toString();
            await project_service_1.ProjectService.addTeamMember(pid, mid, "viewer");
            const result = await project_service_1.ProjectService.updateTeamMemberRole(pid, mid, "admin");
            // updateTeamMemberRole returns { projectId, updatedUser: { userId, role } }
            expect(result.updatedUser.userId).toBe(mid);
            expect(result.updatedUser.role).toBe("admin");
        });
    });
});
