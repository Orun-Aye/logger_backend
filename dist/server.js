"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.globalServices = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./utils/db");
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const log_routes_1 = __importDefault(require("./routes/log.routes"));
const alertRule_routes_1 = __importDefault(require("./routes/alertRule.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const http_1 = require("http");
const websocket_service_1 = require("./services/websocket.service");
const log_service_1 = require("./services/log.service");
const dashboard_service_1 = require("./services/dashboard.service");
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 5000;
const server = (0, http_1.createServer)(app);
const JWT_SECRET = process.env.JWT_SECRET;
// Check if running in Vercel serverless environment
const isVercel = process.env.VERCEL === "1";
app.use((0, cors_1.default)({
    origin: ["https://loghive.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json());
app.use("/api/v1", user_routes_1.default);
app.use("/api/v1/projects", project_routes_1.default);
app.use("/api/v1/", log_routes_1.default);
app.use("/api/v1/alerts", alertRule_routes_1.default);
app.use("/api/v1/dashboard", dashboard_routes_1.default);
// Initialize WebSocket service only if not in Vercel environment
let dashboardWebSocketService = null;
if (!isVercel) {
    dashboardWebSocketService = new websocket_service_1.DashboardWebSocketService(server, JWT_SECRET);
}
// Start the server only if not in Vercel environment
if (!isVercel) {
    const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, db_1.connectDB)(process.env.MONGODB_URI);
        server.listen(PORT, () => {
            console.log(`WebSocket server is running on port ${PORT}`);
        });
    });
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
