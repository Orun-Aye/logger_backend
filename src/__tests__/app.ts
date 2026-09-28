/**
 * Minimal Express app for integration tests.
 * This avoids importing the full server.ts which connects to the real
 * database, starts WebSocket, initializes Redis, etc.
 */
import express from "express";
import userRoutes from "../routes/user.routes";
import logRoutes from "../routes/log.routes";
import changeRoutes from "../routes/change.routes";
import replayRoutes from "../routes/replay.routes";
import sdkConfigRoutes from "../routes/sdk-config.routes";
import sdkConfigPublicRoutes from "../routes/sdk-config-public.routes";

const app = express();

app.use(express.json());

// Mount the routes at the same paths as the real server
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/", logRoutes);
app.use("/api/v1", changeRoutes);
app.use("/api/v1", replayRoutes);
app.use("/api/v1/projects", sdkConfigRoutes);
app.use("/api/v1/sdk-config", sdkConfigPublicRoutes);

export default app;
