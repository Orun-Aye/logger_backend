import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./utils/db";
import projectRoutes from "./routes/project.routes";
import sdkConfigRoutes from "./routes/sdk-config.routes";
import logRoutes from "./routes/log.routes";
import alertRuleRoutes from "./routes/alertRule.routes";
import userRoutes from "./routes/user.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import alertEventRoutes from "./routes/alertEvent.routes";
import notificationRoutes from "./routes/notification.routes";
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

// CORS configuration for dashboard/admin routes (restricted)
const restrictedCors = cors({
  origin: ["https://loghive.vercel.app", "http://localhost:3000"],
  methods: ["POST", "PUT"],
  credentials: false,
  allowedHeaders: ["Content-Type", "Authorization"],
});

// CORS configuration for log ingestion (open to all origins)
const logIngestionCors = cors({
  origin: true, // Allow all origins
  methods: ["POST", "GET"], // Typically logs are POST requests
  credentials: false, // Usually not needed for log ingestion
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-API-Key", // Common for API keys
    "X-Source-Origin", // Custom header to identify source
    "User-Agent",
  ],
});

app.use(express.json());

app.get("/", (req, res) => {
  res.type("html").send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>LogHive on Vercel</title>
      </head>
      <body>
        <h1>Welcome to LogHive on Vercel 🚀</h1>
        <p>Backend Operations Management server for the LogHive platform and Monita SDK.</p>
      </body>
    </html>
  `);
});

// Apply restricted CORS to admin/dashboard routes
app.use("/api/v1/users", restrictedCors, userRoutes);
app.use("/api/v1/projects", restrictedCors, projectRoutes, sdkConfigRoutes);
app.use("/api/v1/alerts", restrictedCors, alertRuleRoutes);
app.use("/api/v1/dashboard", restrictedCors, dashboardRoutes);
app.use("/api/v1/events", restrictedCors, alertEventRoutes);
app.use("/api/v1/notifications", restrictedCors, notificationRoutes);

// Apply open CORS to log ingestion routes
app.use("/api/v1/", logIngestionCors, logRoutes);

// Initialize WebSocket service only if not in Vercel environment
let dashboardWebSocketService: DashboardWebSocketService | null = null;

if (!isVercel) {
  dashboardWebSocketService = new DashboardWebSocketService(server, JWT_SECRET);
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

export default app;
