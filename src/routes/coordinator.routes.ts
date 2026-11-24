import { Router } from 'express';
import { 
  getCoordinators, 
  createCoordinator, 
  assignCoordinator,
  updatePermissions, 
  updateStatus  
} from '../controllers/coordinator.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
// Only Owners should manage coordinators
router.use(requireRole(['OWNER']));

router.get('/', getCoordinators);
router.post('/', createCoordinator);
router.post('/:id/assignments', assignCoordinator);
router.patch('/:id/permissions', updatePermissions);
router.patch('/:id/status', updateStatus);

export default router;
