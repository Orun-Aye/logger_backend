"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const router = (0, express_1.Router)();
// Signup User
router.post("/signup", user_controller_1.UserController.createUser);
// Login User
router.post("/login", user_controller_1.UserController.loginUser);
exports.default = router;
