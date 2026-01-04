import { Router } from 'express';
import { SDKConfigController } from '../controllers/sdk-config.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/:projectId/config', verifyToken, SDKConfigController.getConfig);
router.put('/:projectId/config', verifyToken, SDKConfigController.updateConfig);

export default router;