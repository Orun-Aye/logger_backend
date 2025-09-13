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

// Check if running in Vercel serverless environment
const isVercel = process.env.VERCEL === "1";

app.use(
  cors({
    origin: ["https://loghive.vercel.app"],
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
app.use("/api/v1/dashboard", dashboardRoutes);

// Initialize WebSocket service only if not in Vercel environment
let dashboardWebSocketService: DashboardWebSocketService | null = null;

if (!isVercel) {
  dashboardWebSocketService = new DashboardWebSocketService(
    server,
    JWT_SECRET
  );
}

// Start the server only if not in Vercel environment
if (!isVercel) {
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
} else {
  // In Vercel, just connect to DB without starting server
  connectDB(process.env.MONGODB_URI).catch((err) => {
    console.error("Failed to connect to database:", err);
  });
}

export const globalServices = {
  dashboardWebSocketService,
  logService: LogService,
  dashboardService: DashboardService,
};

export { app };
