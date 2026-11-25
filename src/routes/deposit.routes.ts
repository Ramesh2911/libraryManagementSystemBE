import { Router } from 'express';
import { createDeposit, refundDeposit } from '../controllers/deposit.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));
router.use(requireModule('deposits'));

router.post('/', createDeposit);
router.post('/:id/refund', refundDeposit);

export default router;
