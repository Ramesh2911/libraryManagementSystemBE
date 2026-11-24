import { Router } from 'express';
import { handleAiQuery } from '../controllers/ai.controller';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.post('/query', requireRole(['OWNER']), handleAiQuery);

export default router;
