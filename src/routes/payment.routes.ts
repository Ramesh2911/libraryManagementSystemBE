import { Router } from 'express';
import { 
  recordPayment, 
  getStudentLedger 
} from '../controllers/payment.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Students might be able to fetch their own ledger later, but for now restricted to admins
router.post('/record', requireRole(['OWNER', 'COORDINATOR']), requireModule('payments'), recordPayment);
router.get('/ledger/:studentId', requireRole(['OWNER', 'COORDINATOR']), requireModule('payments'), getStudentLedger);

export default router;
