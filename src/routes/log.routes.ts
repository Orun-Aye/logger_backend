import { Router } from 'express';
import { LogController } from '../controllers/log.controller';
import { authenticateApiKey, verifyToken } from '../middleware/auth.middleware'; // Assuming verifyToken exists
import { validate } from '../middleware/validation.middleware';
import { samplingMiddleware } from '../middleware/sampling.middleware';
import { batchLogSchema, structuredQuerySchema, exportLogsSchema } from '../validators/savedSearch.validator';

const router = Router();

// --- Log Ingestion (typically requires API Key authentication) ---
// Batch create multiple log entries for a specific project
router.post('/:projectId/logs/batch', authenticateApiKey, validate(batchLogSchema, 'body'), LogController.batchCreateLogs);

// Create a new log entry for a specific project
router.post('/:projectId/logs', authenticateApiKey, samplingMiddleware, LogController.createLog);

// --- Log Management and Analytics (typically requires user authentication) ---

// Logs from every project the user can access (global Log Explorer)
router.get('/logs', verifyToken, LogController.getLogsAcrossProjects);

// Get log summary for a project
router.get('/:projectId/logs/summary', verifyToken, LogController.getLogsSummary);

// Get log trends (volume over time) for a project
router.get('/:projectId/logs/trends', verifyToken, LogController.getLogTrends);

// Get distinct values for a specific field within a project's logs (e.g., /levels, /services)
router.get('/:projectId/logs/distinct-values/:field', verifyToken, LogController.getDistinctValues);

// Get unique error messages for a project
router.get('/:projectId/logs/unique-errors', verifyToken, LogController.getUniqueErrorMessages);

// Structured query search for logs
router.post('/:projectId/logs/search', verifyToken, validate(structuredQuerySchema, 'body'), LogController.structuredSearch);

// Export logs to CSV or JSON
router.post('/:projectId/logs/export', verifyToken, validate(exportLogsSchema, 'body'), LogController.exportLogs);

// Get a specific log by ID (should be after more specific routes like /summary, /trends)
router.get('/:projectId/logs/:logId', verifyToken, LogController.getLogById);

// Get all logs for a specific project with filters and pagination
router.get('/:projectId/logs', verifyToken, LogController.getAllLogs);

// Delete logs for a specific project based on filters (bulk delete)
// This route should be placed carefully to avoid conflict with GET /:projectId/logs
// and typically uses DELETE method for idempotent deletion.
router.delete('/:projectId/logs', verifyToken, LogController.deleteLogs);


export default router;