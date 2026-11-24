import { Router } from 'express';
import { 
  getPlatformMetrics,
  getSubscriptions,
  getOwners,
  getRevenueAnalytics
} from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
// Super Admin only routes
router.use(requireRole(['SUPER_ADMIN']));

router.get('/dashboard', getPlatformMetrics);
router.get('/subscriptions', getSubscriptions);
router.get('/owners', getOwners);
router.get('/revenue-analytics', getRevenueAnalytics);

export default router;
