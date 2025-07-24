import { Router } from "express";
import { createProject } from "../controllers/project.controller";

const router = Router();

// Create a new project
router.post("/", createProject);


export default router;