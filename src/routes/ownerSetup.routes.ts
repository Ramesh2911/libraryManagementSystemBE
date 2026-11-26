import { Router } from 'express';
import {
  postBasicDetails,
  postLocationDetails,
  postOperationTiming,
  postRoomsSetup,
  postFeesDeposit,
  getReviewSummary,
  postFinalize,
} from '../controllers/ownerSetup.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Owner-only 6-step onboarding (draft in Redis -> finalize in one transaction)
router.use(authenticateToken);
router.use(requireRole(['OWNER']));

router.post('/basic-details', postBasicDetails);
router.post('/location-details', postLocationDetails);
router.post('/operation-timing', postOperationTiming);
router.post('/rooms-setup', postRoomsSetup);
router.post('/fees-deposit', postFeesDeposit);
router.get('/review-summary', getReviewSummary);
router.post('/finalize', postFinalize);

export default router;
