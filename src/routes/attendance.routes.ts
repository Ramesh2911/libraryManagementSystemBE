import { Router } from 'express';
import { 
  syncAttendance, 
  getStudentAttendance 
} from '../controllers/attendance.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// The sync endpoint is generally called by a Webhook or Biometric sync daemon running on a coordinator PC
router.post('/sync', requireRole(['OWNER', 'COORDINATOR']), syncAttendance);
router.get('/:studentId', requireRole(['OWNER', 'COORDINATOR']), getStudentAttendance);

export default router;
