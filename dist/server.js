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
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./services/db");
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const log_routes_1 = __importDefault(require("./routes/log.routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use(express_1.default.json());
app.use("/api/projects", project_routes_1.default);
app.use("/api/logs", log_routes_1.default);
// Sample route
app.get("/api/health", (req, res, next) => {
    res.status(200).json({ status: "RemoteLogger API is running 🎯" });
});
// Start the server
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, db_1.connectDB)(process.env.MONGODB_URI);
    app.listen(PORT, () => {
        console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
});
startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
