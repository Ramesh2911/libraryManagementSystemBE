import { Router } from 'express';
import { getFeePlans, createFeePlan, updateFeePlan, deleteFeePlan } from '../controllers/feePlan.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));

router.get('/', getFeePlans);
router.post('/', createFeePlan);
router.patch('/:id', updateFeePlan);
router.delete('/:id', deleteFeePlan);

export default router;
