import { Router } from 'express';
import { 
  createAdmission, 
  cancelAdmission 
} from '../controllers/admission.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/', requireRole(['OWNER', 'COORDINATOR']), requireModule('admissions'), createAdmission);
router.post('/:id/cancel', requireRole(['OWNER', 'COORDINATOR']), requireModule('admissions'), cancelAdmission);

export default router;
