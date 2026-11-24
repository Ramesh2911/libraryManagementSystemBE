import { Router } from 'express';
import { 
  getSeatMap, 
  allocateSeat, 
  transferSeat, 
  updateSeatStatus, 
  vacateSeat, 
  getSeatHistory 
} from '../controllers/seat.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
// Seat map might be readable by Students, but allocation/management by OWNER, COORDINATOR
// For simplicity in Phase 2, we restrict all to OWNER/COORDINATOR unless specified.
router.get('/map', getSeatMap);

router.use(requireRole(['OWNER', 'COORDINATOR']));

router.post('/:id/allocate', allocateSeat);
router.post('/:id/transfer', transferSeat);
router.post('/:id/vacate', vacateSeat);
router.patch('/:id/status', updateSeatStatus); // Block / Maintenance
router.get('/:id/history', getSeatHistory);

export default router;
