import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import { connectDB } from "./services/db";
import projectRoutes from "./routes/project.routes";
import logRoutes from "./routes/log.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use("/api/projects", projectRoutes);
app.use("/api/logs", logRoutes);

// Sample route
app.get("/api/health", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({ status: "RemoteLogger API is running 🎯" });
});

// Start the server
const startServer = async () => {
  await connectDB(process.env.MONGODB_URI);

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});