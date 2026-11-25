import { Router } from 'express';
import { getLockers, createLocker, assignLocker, releaseLocker } from '../controllers/locker.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));
router.use(requireModule('lockers'));

router.get('/', getLockers);
router.post('/', createLocker);
router.post('/:id/assign', assignLocker);
router.post('/:id/release', releaseLocker);

export default router;
