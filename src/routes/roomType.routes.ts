import { Router } from 'express';
import { getRoomTypes, createRoomType, updateRoomType, deleteRoomType } from '../controllers/roomType.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));
router.use(requireModule('setup'));

router.get('/', getRoomTypes);
router.post('/', createRoomType);
router.patch('/:id', updateRoomType);
router.delete('/:id', deleteRoomType);

export default router;
