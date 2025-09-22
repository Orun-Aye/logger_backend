"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalServices = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./utils/db");
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const log_routes_1 = __importDefault(require("./routes/log.routes"));
const alertRule_routes_1 = __importDefault(require("./routes/alertRule.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const alertEvent_routes_1 = __importDefault(require("./routes/alertEvent.routes"));
const http_1 = require("http");
const websocket_service_1 = require("./services/websocket.service");
const log_service_1 = require("./services/log.service");
const dashboard_service_1 = require("./services/dashboard.service");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
const server = (0, http_1.createServer)(app);
const JWT_SECRET = process.env.JWT_SECRET;
// Check if running in Vercel serverless environment
const isVercel = process.env.VERCEL === "1";
// CORS configuration for dashboard/admin routes (restricted)
const restrictedCors = (0, cors_1.default)({
    origin: ["https://loghive.vercel.app", "http://localhost:3000"],
    methods: ["POST"],
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization"],
});
// CORS configuration for log ingestion (open to all origins)
const logIngestionCors = (0, cors_1.default)({
    origin: true, // Allow all origins
    methods: ["POST", "GET"], // Typically logs are POST requests
    credentials: false, // Usually not needed for log ingestion
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-API-Key", // Common for API keys
        "X-Source-Origin", // Custom header to identify source
        "User-Agent"
    ],
});
app.use(express_1.default.json());
app.get("/", (req, res) => {
    res.type('html').send(`
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
app.use("/api/v1/users", restrictedCors, user_routes_1.default);
app.use("/api/v1/projects", restrictedCors, project_routes_1.default);
app.use("/api/v1/alerts", restrictedCors, alertRule_routes_1.default);
app.use("/api/v1/dashboard", restrictedCors, dashboard_routes_1.default);
app.use("/api/v1/events", restrictedCors, alertEvent_routes_1.default);
// Apply open CORS to log ingestion routes
app.use("/api/v1/", logIngestionCors, log_routes_1.default);
// Initialize WebSocket service only if not in Vercel environment
let dashboardWebSocketService = null;
if (!isVercel) {
    dashboardWebSocketService = new websocket_service_1.DashboardWebSocketService(server, JWT_SECRET);
}
// Start the server only if not in Vercel environment
if (!isVercel) {
    const startServer = async () => {
        await (0, db_1.connectDB)(process.env.MONGODB_URI);
        server.listen(PORT, () => {
            console.log(`WebSocket server is running on port ${PORT}`);
        });
    };
    startServer().catch((err) => {
        console.error("Failed to start server:", err);
        process.exit(1);
    });
}
else {
    // In Vercel, just connect to DB without starting server
    (0, db_1.connectDB)(process.env.MONGODB_URI).catch((err) => {
        console.error("Failed to connect to database:", err);
    });
}
exports.globalServices = {
    dashboardWebSocketService,
    logService: log_service_1.LogService,
    dashboardService: dashboard_service_1.DashboardService,
};
exports.default = app;
