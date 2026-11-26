import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markNotificationsRead,
} from '../controllers/notification.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['OWNER', 'COORDINATOR']));

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/mark-read', markNotificationsRead);
router.patch('/:id/read', markNotificationRead);

export default router;
