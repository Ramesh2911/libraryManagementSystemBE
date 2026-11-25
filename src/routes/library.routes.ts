import { Router } from 'express';
import { getLibraries, createLibrary, updateLibrary, deleteLibrary } from '../controllers/library.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

// Only OWNER and COORDINATOR can manage libraries
router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));
router.use(requireModule('setup'));

router.get('/', getLibraries);
router.post('/', createLibrary);
router.patch('/:id', updateLibrary);
router.delete('/:id', deleteLibrary);

export default router;
