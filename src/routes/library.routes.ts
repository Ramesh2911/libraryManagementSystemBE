import { Router } from 'express';
import {
  getLibraries,
  deleteLibrary,
} from '../controllers/library.controller';
import {
  getLibraryById,
  createLibraryExtended,
  updateLibrary,
  getOperation,
  putOperation,
  getPricing,
  putPricing,
  getSetupSummary,
  postSetupComplete,
} from '../controllers/librarySetup.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

// Only OWNER and COORDINATOR can manage libraries
router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));
router.use(requireModule('setup'));

// Setup-scoped sub-resources (register before /:id to avoid conflicts is not needed - different paths)
router.get('/:id/operation', getOperation);
router.put('/:id/operation', putOperation);
router.get('/:id/room-type-pricing', getPricing);
router.put('/:id/room-type-pricing', putPricing);
router.get('/:id/setup', getSetupSummary);
router.post('/:id/setup/complete', postSetupComplete);

// Library CRUD
router.get('/', getLibraries);
router.post('/', createLibraryExtended);
router.get('/:id', getLibraryById);
router.patch('/:id', updateLibrary);
router.delete('/:id', deleteLibrary);

export default router;
