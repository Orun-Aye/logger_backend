import { Router } from 'express';
import { createLog, getLogs } from '../controllers/log.controller';

const router = Router();

// Accepts a log event tied to a project via API key
router.post('/', createLog);
router.get('/', getLogs)

export default router;