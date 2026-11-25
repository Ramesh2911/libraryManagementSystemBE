import { Router } from 'express';
import { getVisitors, createVisitor, updateVisitorStatus } from '../controllers/visitor.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));
router.use(requireModule('visitors'));

router.get('/', getVisitors);
router.post('/', createVisitor);
router.patch('/:id/status', updateVisitorStatus);

export default router;
