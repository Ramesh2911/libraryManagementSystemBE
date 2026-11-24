import { Router } from 'express';
import { getFloors, createFloor, updateFloor, deleteFloor } from '../controllers/floor.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));

router.get('/', getFloors);
router.post('/', createFloor);
router.patch('/:id', updateFloor);
router.delete('/:id', deleteFloor);

export default router;
