import { Router } from 'express';
import { LogController } from '../controllers/log.controller';
import { authenticateApiKey } from '../middleware/auth.middleware';

const router = Router();

// Accepts a log event tied to a project via API key
router.post('/logs', authenticateApiKey, LogController.ingestLogs);

export default router;