import { Router } from 'express';
import { getTimeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot } from '../controllers/timeSlot.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));

router.get('/', getTimeSlots);
router.post('/', createTimeSlot);
router.patch('/:id', updateTimeSlot);
router.delete('/:id', deleteTimeSlot);

export default router;
