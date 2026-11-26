import { Router } from 'express';
import {
  getBusinessOverview,
  getRevenue,
  getSeatSummary,
} from '../controllers/dashboard.controller';
import { getActiveOffers, recordOfferAction } from '../controllers/offer.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));

router.get('/business-overview', getBusinessOverview);
router.get('/revenue', getRevenue);

// Seat summary also exposed here for dashboard consumers that prefer this prefix
router.get('/seats/summary', getSeatSummary);

// Offer banner (dashboard mount)
router.get('/offers/active', getActiveOffers);
router.post('/offers/:id/action', recordOfferAction);

export default router;
