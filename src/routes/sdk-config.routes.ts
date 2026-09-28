import { Router } from 'express';
import { SDKConfigController } from '../controllers/sdk-config.controller';
import { verifyToken } from '../middleware/auth.middleware';
import { authorizeProjectAccess } from '../middleware/authorizeProjectAccess';

const router = Router();

// Project members only: without authorizeProjectAccess any signed-in user
// could read or change any project's SDK config
router.get('/:projectId/config', verifyToken, authorizeProjectAccess, SDKConfigController.getConfig);
router.put('/:projectId/config', verifyToken, authorizeProjectAccess, SDKConfigController.updateConfig);

// Session replay; changes are owner/admin only (checked in the controller)
router.get('/:projectId/config/replay', verifyToken, authorizeProjectAccess, SDKConfigController.getReplaySettings);
router.put('/:projectId/config/replay', verifyToken, authorizeProjectAccess, SDKConfigController.updateReplaySettings);

export default router;
