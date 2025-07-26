import { Router } from "express";
import { UserController } from "../controllers/user.controller";


const router = Router();

// Signup User
router.post("/signup", UserController.createUser);

// Login User
router.post("/login", UserController.loginUser);


export default router;