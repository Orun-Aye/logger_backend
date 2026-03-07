import { Types } from "mongoose";
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectValidationError,
} from "../../services/project.service";
import { ProjectModel } from "../../models/project.model";
import { createTestUser, createTestProject } from "../factories";

describe("ProjectService", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser();
    userId = (user._id as Types.ObjectId).toString();
  });

  // ----- createProject -----
  describe("createProject", () => {
    it("should create a project with valid data", async () => {
      const result = await ProjectService.createProject({
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
      const result1 = await ProjectService.createProject({
        name: "Project A",
        ownerId: userId,
      });
      const result2 = await ProjectService.createProject({
        name: "Project B",
        ownerId: userId,
      });

      expect(result1.apiKey).not.toBe(result2.apiKey);
    });

    it("should throw validation error for empty name", async () => {
      await expect(
        ProjectService.createProject({ name: "", ownerId: userId })
      ).rejects.toThrow(ProjectValidationError);
    });

    it("should throw validation error for name exceeding 100 chars", async () => {
      const longName = "a".repeat(101);
      await expect(
        ProjectService.createProject({ name: longName, ownerId: userId })
      ).rejects.toThrow(ProjectValidationError);
    });

    it("should throw for duplicate project name", async () => {
      await ProjectService.createProject({
        name: "Unique Name",
        ownerId: userId,
      });

      await expect(
        ProjectService.createProject({
          name: "Unique Name",
          ownerId: userId,
        })
      ).rejects.toThrow("Project with this name already exists");
    });

    it("should add the owner as admin team member", async () => {
      const result = await ProjectService.createProject({
        name: "Team Project",
        ownerId: userId,
      });

      const project = await ProjectModel.findById(result.id);
      expect(project!.teamMembers).toHaveLength(1);
      expect(project!.teamMembers[0].user.toString()).toBe(userId);
      expect(project!.teamMembers[0].role).toBe("admin");
    });
  });

  // ----- getProjectById -----
  describe("getProjectById", () => {
    it("should return a project by its ID", async () => {
      const project = await createTestProject(userId);
      const result = await ProjectService.getProjectById(
        (project._id as Types.ObjectId).toString(),
        { includeAnalytics: false }
      );

      expect(result.project).toBeDefined();
      expect(result.project.name).toBe(project.name);
    });

    it("should throw ProjectNotFoundError for non-existent ID", async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(
        ProjectService.getProjectById(fakeId, { includeAnalytics: false })
      ).rejects.toThrow(ProjectNotFoundError);
    });

    it("should throw ProjectValidationError for invalid ID format", async () => {
      await expect(
        ProjectService.getProjectById("not-a-valid-id", {
          includeAnalytics: false,
        })
      ).rejects.toThrow(ProjectValidationError);
    });
  });

  // ----- getProjectsByUser -----
  describe("getProjectsByUser", () => {
    it("should return projects owned by the user", async () => {
      await createTestProject(userId, { name: "User Project 1" });
      await createTestProject(userId, { name: "User Project 2" });

      const result = await ProjectService.getProjectsByUser(userId, {
        includeMetrics: false,
      });

      expect(result.projects.length).toBe(2);
    });

    it("should return empty array for user with no projects", async () => {
      const anotherUser = await createTestUser({ email: "empty@example.com" });
      const result = await ProjectService.getProjectsByUser(
        (anotherUser._id as Types.ObjectId).toString(),
        { includeMetrics: false }
      );

      expect(result.projects.length).toBe(0);
    });

    it("should throw for invalid user ID format", async () => {
      await expect(
        ProjectService.getProjectsByUser("bad-id", { includeMetrics: false })
      ).rejects.toThrow(ProjectValidationError);
    });
  });

  // ----- updateProject -----
  describe("updateProject", () => {
    it("should update project name and description", async () => {
      const project = await createTestProject(userId);
      const result = await ProjectService.updateProject(
        (project._id as Types.ObjectId).toString(),
        {
          name: "Updated Name",
          description: "Updated description",
        }
      );

      expect(result.name).toBe("Updated Name");
      expect(result.description).toBe("Updated description");
    });

    it("should throw ProjectNotFoundError for non-existent project", async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(
        ProjectService.updateProject(fakeId, { name: "X" })
      ).rejects.toThrow(ProjectNotFoundError);
    });
  });

  // ----- deleteProject -----
  describe("deleteProject", () => {
    it("should soft delete a project by default (set isActive to false)", async () => {
      const project = await createTestProject(userId);
      await ProjectService.deleteProject(
        (project._id as Types.ObjectId).toString()
      );

      const deletedProject = await ProjectModel.findById(project._id);
      expect(deletedProject!.isActive).toBe(false);
    });

    it("should hard delete when softDelete is false", async () => {
      const project = await createTestProject(userId);
      await ProjectService.deleteProject(
        (project._id as Types.ObjectId).toString(),
        false
      );

      const deletedProject = await ProjectModel.findById(project._id);
      expect(deletedProject).toBeNull();
    });

    it("should throw for non-existent project", async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(ProjectService.deleteProject(fakeId)).rejects.toThrow(
        ProjectNotFoundError
      );
    });
  });

  // ----- regenerateApiKey -----
  describe("regenerateApiKey", () => {
    it("should generate a new API key different from the old one", async () => {
      const project = await createTestProject(userId);
      const oldApiKey = project.apiKey;

      const result = await ProjectService.regenerateApiKey(
        (project._id as Types.ObjectId).toString()
      );

      expect(result.apiKey).toBeDefined();
      expect(result.apiKey).not.toBe(oldApiKey);
    });

    it("should throw for non-existent project", async () => {
      const fakeId = new Types.ObjectId().toString();
      await expect(
        ProjectService.regenerateApiKey(fakeId)
      ).rejects.toThrow(ProjectNotFoundError);
    });
  });

  // ----- Team Member Management -----
  describe("addTeamMember", () => {
    it("should add a team member to the project", async () => {
      const project = await createTestProject(userId);
      const member = await createTestUser({ email: "member@example.com" });

      const result = await ProjectService.addTeamMember(
        (project._id as Types.ObjectId).toString(),
        (member._id as Types.ObjectId).toString(),
        "viewer"
      );

      // addTeamMember returns { projectId, teamMember, totalMembers }
      expect(result.totalMembers).toBeGreaterThanOrEqual(2);
      expect(result.teamMember.userId).toBe(
        (member._id as Types.ObjectId).toString()
      );
      expect(result.teamMember.role).toBe("viewer");
    });

    it("should throw for duplicate team member", async () => {
      const project = await createTestProject(userId);
      const member = await createTestUser({ email: "dup-member@example.com" });
      const pid = (project._id as Types.ObjectId).toString();
      const mid = (member._id as Types.ObjectId).toString();

      await ProjectService.addTeamMember(pid, mid, "viewer");

      await expect(
        ProjectService.addTeamMember(pid, mid, "admin")
      ).rejects.toThrow();
    });
  });

  describe("removeTeamMember", () => {
    it("should remove a team member from the project", async () => {
      const project = await createTestProject(userId);
      const member = await createTestUser({ email: "removable@example.com" });
      const pid = (project._id as Types.ObjectId).toString();
      const mid = (member._id as Types.ObjectId).toString();

      await ProjectService.addTeamMember(pid, mid, "viewer");

      const result = await ProjectService.removeTeamMember(pid, mid);

      // removeTeamMember returns { projectId, removedUserId, totalMembers }
      expect(result.removedUserId).toBe(mid);
      expect(result.totalMembers).toBe(1); // only owner remains
    });
  });

  describe("updateTeamMemberRole", () => {
    it("should update a team member's role", async () => {
      const project = await createTestProject(userId);
      const member = await createTestUser({ email: "role-update@example.com" });
      const pid = (project._id as Types.ObjectId).toString();
      const mid = (member._id as Types.ObjectId).toString();

      await ProjectService.addTeamMember(pid, mid, "viewer");

      const result = await ProjectService.updateTeamMemberRole(
        pid,
        mid,
        "admin"
      );

      // updateTeamMemberRole returns { projectId, updatedUser: { userId, role } }
      expect(result.updatedUser.userId).toBe(mid);
      expect(result.updatedUser.role).toBe("admin");
    });
  });
});
