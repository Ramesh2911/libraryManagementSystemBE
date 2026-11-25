import { Router } from 'express';
import { getReadingRooms, createReadingRoom, updateReadingRoom, deleteReadingRoom } from '../controllers/readingRoom.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

// Only OWNER and COORDINATOR can manage reading rooms
router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));
router.use(requireModule('setup'));

router.get('/', getReadingRooms);
router.post('/', createReadingRoom);
router.patch('/:id', updateReadingRoom);
router.delete('/:id', deleteReadingRoom);

export default router;
