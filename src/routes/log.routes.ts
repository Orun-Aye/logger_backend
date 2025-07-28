import { Router } from 'express';
import { LogController } from '../controllers/log.controller';
import { authenticateApiKey } from '../middleware/auth.middleware';

const router = Router();


router.post('/:projectId/logs', LogController.createLog);
router.get('/:projectId/logs', LogController.getAllLogs);
router.get('/:projectId/logs/:logId', LogController.getLogById);

export default router;
