import { Router } from 'express';
import { replayController } from '../controllers/replay.controller';
import { authenticateApiKey, verifyToken } from '../middleware/auth.middleware';
import { authorizeProjectAccess } from '../middleware/authorizeProjectAccess';

const router = Router();

// Ingestion — API Key auth (from SDK)
router.post('/:projectId/replay', authenticateApiKey, replayController.ingestReplay);

// Retrieval — JWT auth (from dashboard), project owner or team members only.
// Replays are screen recordings: never serve them to other users.
router.get('/:projectId/replay/sessions', verifyToken, authorizeProjectAccess, replayController.listSessions);
// Static paths before /:sessionId, or "available" would be read as a session ID
router.get('/:projectId/replay/available', verifyToken, authorizeProjectAccess, replayController.getAvailableReplays);
router.get('/:projectId/replay/:sessionId', verifyToken, authorizeProjectAccess, replayController.getSessionSegments);
router.delete('/:projectId/replay/sessions/:sessionId', verifyToken, authorizeProjectAccess, replayController.deleteSession);

export default router;
