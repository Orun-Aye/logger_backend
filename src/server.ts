import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import { connectDB } from "./utils/db";
import projectRoutes from "./routes/project.routes";
import logRoutes from "./routes/log.routes";
import alertRuleRoutes from "./routes/alertRule.routes";
import userRoutes from "./routes/user.routes";
import insightRoutes from "./routes/insights.routes"
import cors from "cors"; 

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true, // This is important if you are sending cookies or authorization headers
}));

app.use(express.json());

app.use("/api/v1", userRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/", logRoutes);
app.use('/api/v1/alerts', alertRuleRoutes);
app.use('/api/v1/dashboard/', insightRoutes);


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
