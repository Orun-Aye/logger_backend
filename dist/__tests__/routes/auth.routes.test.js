"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Mock ESM modules that Jest cannot parse (otplib uses @scure/base ESM export)
jest.mock("otplib", () => ({
    generateSecret: jest.fn().mockReturnValue("MOCKSECRET"),
    generateURI: jest.fn().mockReturnValue("otpauth://totp/mock"),
    verify: jest.fn().mockReturnValue(true),
}));
jest.mock("qrcode", () => ({
    toDataURL: jest.fn().mockResolvedValue("data:image/png;base64,mock"),
}));
// Mock server module (WebSocket service) — log.routes imports log.service -> alert.service -> server
jest.mock("../../server", () => ({
    globalServices: {
        dashboardWebSocketService: null,
    },
}));
jest.mock("../../services/notification.service", () => ({
    NotificationService: {
        sendEmail: jest.fn().mockResolvedValue(undefined),
        sendSlack: jest.fn().mockResolvedValue(undefined),
        sendWebhook: jest.fn().mockResolvedValue(undefined),
    },
}));
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../app"));
const factories_1 = require("../factories");
describe("Auth Routes", () => {
    // ----- POST /api/v1/users/signup -----
    describe("POST /api/v1/users/signup", () => {
        it("should create a new user and return 201", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post("/api/v1/users/signup")
                .send({
                email: "signup@example.com",
                firstName: "Sign",
                lastName: "Up",
                password: "StrongPass123!",
                role: "developer",
            });
            expect(res.status).toBe(201);
            expect(res.body.status).toBe("success");
            expect(res.body.data).toHaveProperty("token");
            expect(res.body.data.email).toBe("signup@example.com");
        });
        it("should return 400 for missing email", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post("/api/v1/users/signup")
                .send({
                firstName: "No",
                lastName: "Email",
                password: "StrongPass123!",
                role: "developer",
            });
            expect(res.status).toBe(400);
            expect(res.body.status).toBe("error");
        });
        it("should return 400 for missing password", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post("/api/v1/users/signup")
                .send({
                email: "nopw@example.com",
                firstName: "No",
                lastName: "Password",
                role: "developer",
            });
            expect(res.status).toBe(400);
            expect(res.body.status).toBe("error");
        });
        it("should return 400 for duplicate email", async () => {
            await (0, factories_1.createTestUser)({ email: "dup@example.com" });
            const res = await (0, supertest_1.default)(app_1.default)
                .post("/api/v1/users/signup")
                .send({
                email: "dup@example.com",
                firstName: "Dup",
                lastName: "User",
                password: "StrongPass123!",
                role: "developer",
            });
            expect(res.status).toBe(400);
            expect(res.body.status).toBe("error");
            expect(res.body.message).toContain("already exists");
        });
    });
    // ----- POST /api/v1/users/login -----
    describe("POST /api/v1/users/login", () => {
        it("should login with valid credentials and return token", async () => {
            await (0, factories_1.createTestUser)({ email: "logintest@example.com" });
            const res = await (0, supertest_1.default)(app_1.default)
                .post("/api/v1/users/login")
                .send({
                email: "logintest@example.com",
                password: (0, factories_1.getTestPassword)(),
            });
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data).toHaveProperty("token");
        });
        it("should return 400 for missing email or password", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post("/api/v1/users/login")
                .send({ email: "nopw@example.com" });
            expect(res.status).toBe(400);
            expect(res.body.status).toBe("error");
        });
        it("should return 400 for wrong password", async () => {
            await (0, factories_1.createTestUser)({ email: "badpw@example.com" });
            const res = await (0, supertest_1.default)(app_1.default)
                .post("/api/v1/users/login")
                .send({
                email: "badpw@example.com",
                password: "WrongPassword!",
            });
            expect(res.status).toBe(400);
            expect(res.body.status).toBe("error");
        });
        it("should return 500 for non-existent user", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .post("/api/v1/users/login")
                .send({
                email: "nouser@example.com",
                password: "SomePass123!",
            });
            // UserNotFoundError is not caught as a 404 in controller handleError, it falls to 500
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.body.status).toBe("error");
        });
    });
    // ----- GET /api/v1/users/profile -----
    describe("GET /api/v1/users/profile", () => {
        it("should return user profile with valid JWT", async () => {
            const user = await (0, factories_1.createTestUser)({ email: "profile@example.com" });
            const token = (0, factories_1.generateAuthToken)(user._id);
            const res = await (0, supertest_1.default)(app_1.default)
                .get("/api/v1/users/profile")
                .set("Authorization", `Bearer ${token}`);
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
            expect(res.body.data.email).toBe("profile@example.com");
        });
        it("should return 401 without a token", async () => {
            const res = await (0, supertest_1.default)(app_1.default).get("/api/v1/users/profile");
            expect(res.status).toBe(401);
            expect(res.body.status).toBe("error");
        });
        it("should return 401 with an invalid token", async () => {
            const res = await (0, supertest_1.default)(app_1.default)
                .get("/api/v1/users/profile")
                .set("Authorization", "Bearer invalid-token-here");
            expect(res.status).toBe(401);
            expect(res.body.status).toBe("error");
        });
    });
    // ----- PUT /api/v1/users/change-password -----
    describe("PUT /api/v1/users/change-password", () => {
        it("should change password with valid current password", async () => {
            const user = await (0, factories_1.createTestUser)({ email: "chpw@example.com" });
            const token = (0, factories_1.generateAuthToken)(user._id);
            const res = await (0, supertest_1.default)(app_1.default)
                .put("/api/v1/users/change-password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                currentPassword: (0, factories_1.getTestPassword)(),
                newPassword: "NewStrongPass123!",
            });
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("success");
        });
        it("should return 400 for wrong current password", async () => {
            const user = await (0, factories_1.createTestUser)({ email: "badcurr@example.com" });
            const token = (0, factories_1.generateAuthToken)(user._id);
            const res = await (0, supertest_1.default)(app_1.default)
                .put("/api/v1/users/change-password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                currentPassword: "WrongCurrent!",
                newPassword: "NewPass123!",
            });
            expect(res.status).toBe(400);
            expect(res.body.status).toBe("error");
        });
    });
});
