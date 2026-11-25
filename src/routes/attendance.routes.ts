import { Router } from 'express';
import { 
  syncAttendance, 
  getStudentAttendance 
} from '../controllers/attendance.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

// The sync endpoint is generally called by a Webhook or Biometric sync daemon running on a coordinator PC
router.post('/sync', requireRole(['OWNER', 'COORDINATOR']), requireModule('attendance'), syncAttendance);
router.get('/:studentId', requireRole(['OWNER', 'COORDINATOR']), requireModule('attendance'), getStudentAttendance);

export default router;
