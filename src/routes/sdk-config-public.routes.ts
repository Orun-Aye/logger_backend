import { Router } from 'express';
import { SDKConfigController } from '../controllers/sdk-config.controller';
import { authenticateApiKey } from '../middleware/auth.middleware';

const router = Router();

// SDK fetches its remote config via API key (no JWT needed)
// GET /api/v1/sdk-config — with X-API-Key header
router.get('/', authenticateApiKey, SDKConfigController.getConfigByApiKey);

export default router;
