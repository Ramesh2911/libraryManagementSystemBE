import { Router } from 'express';
import {
  getSeatMap,
  allocateSeat,
  transferSeat,
  updateSeatStatus,
  vacateSeat,
  getSeatHistory
} from '../controllers/seat.controller';
import { getSeatSummary } from '../controllers/dashboard.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
// Seat map might be readable by Students, but allocation/management by OWNER, COORDINATOR
// For simplicity in Phase 2, we restrict all to OWNER/COORDINATOR unless specified.
router.get('/map', getSeatMap);
// Dashboard seat statistics - OWNER/COORDINATOR (registered before /:id/* routes)
router.get('/summary', requireRole(['OWNER', 'COORDINATOR']), getSeatSummary);

router.use(requireRole(['OWNER', 'COORDINATOR']));
router.use(requireModule('seats'));

router.post('/:id/allocate', allocateSeat);
router.post('/:id/transfer', transferSeat);
router.post('/:id/vacate', vacateSeat);
router.patch('/:id/status', updateSeatStatus); // Block / Maintenance
router.get('/:id/history', getSeatHistory);

export default router;
