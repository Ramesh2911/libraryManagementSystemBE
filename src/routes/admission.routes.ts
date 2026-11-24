import { Router } from 'express';
import { 
  createAdmission, 
  cancelAdmission 
} from '../controllers/admission.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/', requireRole(['OWNER', 'COORDINATOR']), createAdmission);
router.post('/:id/cancel', requireRole(['OWNER', 'COORDINATOR']), cancelAdmission);

export default router;
