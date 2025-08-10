import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./utils/db";
import projectRoutes from "./routes/project.routes";
import logRoutes from "./routes/log.routes";
import alertRuleRoutes from "./routes/alertRule.routes";
import userRoutes from "./routes/user.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import { createServer } from "http";
import { DashboardWebSocketService } from "./services/websocket.service";
import { LogService } from "./services/log.service";
import { DashboardService } from "./services/dashboard.service";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = createServer(app);
const JWT_SECRET = process.env.JWT_SECRET!;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use("/api/v1", userRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/", logRoutes);
app.use("/api/v1/alerts", alertRuleRoutes);
app.use("/api/v1/dashboard/", dashboardRoutes);

const dashboardWebSocketService = new DashboardWebSocketService(
  server,
  JWT_SECRET
);

// Start the server
const startServer = async () => {
  await connectDB(process.env.MONGODB_URI);

  server.listen(PORT, () => {
    console.log(`WebSocket server is running on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export const globalServices = {
  dashboardWebSocketService,
  logService: LogService,
  dashboardService: DashboardService,
};
