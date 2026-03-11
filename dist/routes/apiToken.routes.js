"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const apiToken_controller_1 = require("../controllers/apiToken.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Guard: reject requests authenticated via personal API tokens (mt_).
// Token management requires a real JWT session.
function requireJwtSession(req, res, next) {
    if (req.tokenScopes) {
        res.status(403).json({
            status: "error",
            code: "JWT_REQUIRED",
            message: "Token management requires a JWT session. API tokens cannot manage other tokens.",
        });
        return;
    }
    next();
}
// All token management routes require JWT authentication.
// Personal API tokens (mt_) cannot be used to manage tokens themselves.
router.post("/", auth_middleware_1.verifyToken, requireJwtSession, apiToken_controller_1.ApiTokenController.createToken);
router.get("/", auth_middleware_1.verifyToken, requireJwtSession, apiToken_controller_1.ApiTokenController.listTokens);
router.delete("/:tokenId", auth_middleware_1.verifyToken, requireJwtSession, apiToken_controller_1.ApiTokenController.revokeToken);
exports.default = router;
