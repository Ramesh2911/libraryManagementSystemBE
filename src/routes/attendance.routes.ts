import { Router } from 'express';
import {
  syncAttendance,
  createQrSession,
  getQrSession,
  stopQrSession,
  studentCheckIn,
  studentCheckOut,
  manualAttendance,
  correctAttendance,
  dailyRegister,
  monthlyReport,
  getStudentAttendance,
} from '../controllers/attendance.controller';
import { authenticateToken, requireRole, requireModule } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

const staffGate = [
  requireRole(['OWNER', 'COORDINATOR']),
  requireModule('attendance'),
];

// Biometric daemon — legacy raw response shape
router.post('/sync', ...staffGate, syncAttendance);

// QR session management (specific paths before /:studentId)
router.post('/qr/session', ...staffGate, createQrSession);
router.get('/qr/session', ...staffGate, getQrSession);
router.post('/qr/session/stop', ...staffGate, stopQrSession);

// Manual + register + report
router.post('/manual', ...staffGate, manualAttendance);
router.get('/report/monthly', ...staffGate, monthlyReport);
router.get('/', ...staffGate, dailyRegister);

// Student QR (JWT sub = student id; never trust body studentId)
router.post('/qr/check-in', requireRole(['STUDENT']), studentCheckIn);
router.post('/qr/check-out', requireRole(['STUDENT']), studentCheckOut);

// Correction (path param) — before bare /:studentId
router.patch('/:attendanceId/correct', ...staffGate, correctAttendance);

// History last — staff or STUDENT self only
router.get(
  '/:studentId',
  requireRole(['OWNER', 'COORDINATOR', 'STUDENT']),
  getStudentAttendance
);

export default router;
