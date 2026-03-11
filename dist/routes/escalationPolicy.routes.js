"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const escalationPolicy_controller_1 = require("../controllers/escalationPolicy.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
// CRUD operations
router.post("/", escalationPolicy_controller_1.EscalationPolicyController.create);
router.get("/project/:projectId", escalationPolicy_controller_1.EscalationPolicyController.getByProject);
router.get("/:id", escalationPolicy_controller_1.EscalationPolicyController.getById);
router.put("/:id", escalationPolicy_controller_1.EscalationPolicyController.update);
router.delete("/:id", escalationPolicy_controller_1.EscalationPolicyController.delete);
exports.default = router;
