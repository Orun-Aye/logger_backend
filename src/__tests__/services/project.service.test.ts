import { Types } from "mongoose";
import {
  ProjectService,
  ProjectNotFoundError,
  ProjectValidationError,
} from "../../services/project.service";
import { ProjectModel, repairProjectNameIndexes } from "../../models/project.model";
import { createTestUser, createTestProject, createTestLog } from "../factories";

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
      ).rejects.toThrow("You already have a project with this name");
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

    it("should return a zero-filled 30-minute volume series for a 24h range", async () => {
      const project = await createTestProject(userId);
      const projectId = (project._id as Types.ObjectId).toString();
      const ago = (minutes: number) =>
        new Date(Date.now() - minutes * 60_000).toISOString();
      await createTestLog(projectId, { timestamp: ago(5) });
      await createTestLog(projectId, { timestamp: ago(6), level: "error" });
      await createTestLog(projectId, { timestamp: ago(600) });
      await createTestLog(projectId, { timestamp: ago(3000) }); // outside 24h

      const result = await ProjectService.getProjectById(projectId, {
        timeRange: 24,
        includeRecommendations: false,
      });
      const volume = (result.analytics as any).trends.volume;

      expect(volume.bucketMinutes).toBe(30);
      // 48 half-hour buckets, plus one when the window straddles a boundary
      expect(volume.buckets.length).toBeGreaterThanOrEqual(48);
      expect(volume.buckets.length).toBeLessThanOrEqual(49);
      const sum = (key: "totalLogs" | "errorLogs") =>
        volume.buckets.reduce((n: number, b: any) => n + b[key], 0);
      expect(sum("totalLogs")).toBe(3);
      expect(sum("errorLogs")).toBe(1);
      expect(volume.buckets.filter((b: any) => b.totalLogs === 0).length)
        .toBeGreaterThan(40);
    });

    it("should average response time over network requests only", async () => {
      const project = await createTestProject(userId);
      const projectId = (project._id as Types.ObjectId).toString();
      await createTestLog(projectId, {
        eventType: "network",
        data: { network: { url: "/api/a", duration: 100 } },
      });
      await createTestLog(projectId, {
        eventType: "network",
        data: { network: { url: "/api/b", duration: 300 } },
      });
      // A slow page load is not a response and must not drag the average up
      await createTestLog(projectId, {
        eventType: "performance",
        data: { performance: { type: "navigation", duration: 8000 } },
      });

      const result = await ProjectService.getProjectById(projectId, {
        timeRange: 24,
        includeRecommendations: false,
      });
      const current = (result.analytics as any).responseTime.current;

      expect(current.avgResponseTime).toBe(200);
      expect(current.responseTimeCount).toBe(2);
    });
  });

  // ----- syncLogCount -----
  describe("syncLogCount", () => {
    it("should store the live count and the newest log's time, not now", async () => {
      const project = await createTestProject(userId, { logCount: 0 });
      const projectId = (project._id as Types.ObjectId).toString();
      const newest = new Date(Date.now() - 3 * 86_400_000);
      await createTestLog(projectId, {
        timestamp: new Date(newest.getTime() - 60_000).toISOString(),
      });
      await createTestLog(projectId, { timestamp: newest.toISOString() });

      const result = await ProjectService.syncLogCount(projectId);

      expect(result.actualCount).toBe(2);
      const stored = await ProjectModel.findById(projectId).lean();
      expect(stored!.logCount).toBe(2);
      expect(stored!.lastIngestedAt!.getTime()).toBe(newest.getTime());
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

    it("should count logs live and report the newest log as lastActivity", async () => {
      // A stale stored counter, as left behind by ingestion that never bumped it
      const project = await createTestProject(userId, { logCount: 0 });
      const projectId = (project._id as Types.ObjectId).toString();
      const newest = new Date(Date.now() - 60_000).toISOString();
      await createTestLog(projectId, {
        timestamp: new Date(Date.now() - 9 * 86_400_000).toISOString(),
      });
      await createTestLog(projectId, { timestamp: newest });

      const result = await ProjectService.getProjectsByUser(userId);
      const metrics = (result.projects[0] as any).metrics;

      expect(metrics.totalLogs).toBe(2);
      expect(metrics.lastActivity).toBe(newest);
    });

    it("should report zero logs and no activity for an empty project", async () => {
      await createTestProject(userId, { logCount: 7019 });

      const result = await ProjectService.getProjectsByUser(userId);
      const metrics = (result.projects[0] as any).metrics;

      expect(metrics.totalLogs).toBe(0);
      expect(metrics.lastActivity).toBeNull();
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

  // ----- project names are unique per owner, not across Apperio -----
  describe("project names", () => {
    let otherUserId: string;

    beforeEach(async () => {
      const other = await createTestUser();
      otherUserId = (other._id as Types.ObjectId).toString();
    });

    it("lets two different owners use the same name", async () => {
      await ProjectService.createProject({ name: "Demo Shop", ownerId: userId });
      const theirs = await ProjectService.createProject({ name: "Demo Shop", ownerId: otherUserId });

      expect(theirs.name).toBe("Demo Shop");
      expect(await ProjectModel.countDocuments({ name: "Demo Shop" })).toBe(2);
    });

    it("still refuses a second project with the same name for one owner", async () => {
      await ProjectService.createProject({ name: "Demo Shop", ownerId: userId });

      await expect(
        ProjectService.createProject({ name: "Demo Shop", ownerId: userId })
      ).rejects.toThrow("You already have a project with this name");
    });

    it("allows renaming to a name only another owner uses", async () => {
      await ProjectService.createProject({ name: "Storefront", ownerId: otherUserId });
      const mine = await ProjectService.createProject({ name: "Mine", ownerId: userId });

      const renamed = await ProjectService.updateProject(String(mine.id), { name: "Storefront" });
      expect(renamed.name).toBe("Storefront");
    });

    it("refuses renaming to a name the same owner already uses", async () => {
      await ProjectService.createProject({ name: "Storefront", ownerId: userId });
      const mine = await ProjectService.createProject({ name: "Mine", ownerId: userId });

      await expect(
        ProjectService.updateProject(String(mine.id), { name: "Storefront" })
      ).rejects.toThrow("You already have a project with this name");
    });

    it("lets an owner duplicate a project under a name someone else uses", async () => {
      await ProjectService.createProject({ name: "Copy", ownerId: otherUserId });
      const source = await ProjectService.createProject({ name: "Source", ownerId: userId });

      const copy = await ProjectService.duplicateProject(String(source.id), "Copy", userId);
      expect(copy.newProjectName).toBe("Copy");
    });

    it("repairs a database that still has the global unique name index", async () => {
      await ProjectModel.collection.createIndex({ name: 1 }, { unique: true, name: "name_1" });

      expect(await repairProjectNameIndexes()).toEqual(["name_1"]);
      const names = (await ProjectModel.collection.indexes()).map((i) => i.name);
      expect(names).toContain("ownerId_name_unique");
      expect(names).not.toContain("name_1");

      await ProjectService.createProject({ name: "Shared", ownerId: userId });
      await ProjectService.createProject({ name: "Shared", ownerId: otherUserId });
      expect(await ProjectModel.countDocuments({ name: "Shared" })).toBe(2);

      // Safe to run on every boot
      expect(await repairProjectNameIndexes()).toEqual([]);
    });

    it("refuses a transfer when the new owner already has a project with that name", async () => {
      await ProjectService.createProject({ name: "Demo Shop", ownerId: otherUserId });
      const mine = await ProjectService.createProject({ name: "Demo Shop", ownerId: userId });

      await expect(
        ProjectService.transferOwnership(String(mine.id), otherUserId, userId)
      ).rejects.toThrow(/already has a project called "Demo Shop"/);
    });
  });
});
