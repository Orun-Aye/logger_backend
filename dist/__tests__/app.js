"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Minimal Express app for integration tests.
 * This avoids importing the full server.ts which connects to the real
 * database, starts WebSocket, initializes Redis, etc.
 */
const express_1 = __importDefault(require("express"));
const user_routes_1 = __importDefault(require("../routes/user.routes"));
const log_routes_1 = __importDefault(require("../routes/log.routes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Mount the routes at the same paths as the real server
app.use("/api/v1/users", user_routes_1.default);
app.use("/api/v1/", log_routes_1.default);
exports.default = app;
