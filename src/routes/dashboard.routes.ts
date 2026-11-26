import { Router } from 'express';
import { getBusinessOverview, getRevenue, getSeatSummary } from '../controllers/dashboard.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));

router.get('/business-overview', getBusinessOverview);
router.get('/revenue', getRevenue);

// Seat summary also exposed here for dashboard consumers that prefer this prefix
router.get('/seats/summary', getSeatSummary);

export default router;
