import { Router, Request, Response, NextFunction } from "express";
import { ApiTokenController } from "../controllers/apiToken.controller";
import { verifyToken } from "../middleware/auth.middleware";

const router = Router();

// Guard: reject requests authenticated via personal API tokens (mt_).
// Token management requires a real JWT session.
function requireJwtSession(req: Request, res: Response, next: NextFunction): void {
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
router.post("/", verifyToken, requireJwtSession, ApiTokenController.createToken);
router.get("/", verifyToken, requireJwtSession, ApiTokenController.listTokens);
router.delete("/:tokenId", verifyToken, requireJwtSession, ApiTokenController.revokeToken);

export default router;
