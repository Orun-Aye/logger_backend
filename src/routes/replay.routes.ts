import { Router } from 'express';
import { replayController } from '../controllers/replay.controller';
import { authenticateApiKey, verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Ingestion — API Key auth (from SDK)
router.post('/:projectId/replay', authenticateApiKey, replayController.ingestReplay);

// Retrieval — JWT auth (from dashboard)
router.get('/:projectId/replay/sessions', verifyToken, replayController.listSessions);
router.get('/:projectId/replay/:sessionId', verifyToken, replayController.getSessionSegments);
router.delete('/:projectId/replay/sessions/:sessionId', verifyToken, replayController.deleteSession);

export default router;
