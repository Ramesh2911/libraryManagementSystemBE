import { Router } from 'express';
import {
  getActiveOffers,
  listOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  recordOfferAction,
} from '../controllers/offer.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// Active banners - any authenticated tenant user
router.get('/active', getActiveOffers);

// Admin CRUD - OWNER only
router.use(requireRole(['OWNER']));
router.get('/', listOffers);
router.post('/', createOffer);
router.patch('/:id', updateOffer);
router.delete('/:id', deleteOffer);

// Action endpoint also lives under dashboard; keep for /offers/:id/action parity
router.post('/:id/action', requireRole(['OWNER', 'COORDINATOR']), recordOfferAction);

export default router;
