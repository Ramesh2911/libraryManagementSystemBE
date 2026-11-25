import { Router } from 'express';
import { 
  tenantLogin, 
  superAdminLogin,
  signup,
  setup2FA,
  verify2FASetup,
  verify2FALogin,
  refreshToken,
  logout,
  resetPassword,
  getSessions,
  revokeSession,
  sendLoginOtp,
  resendLoginOtp,
  getMe
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Public Routes
router.post('/signup', signup);
router.post('/login', tenantLogin); // phone + password (all tenant roles)
router.post('/login/verify-2fa', verify2FALogin);
router.post('/admin/login', superAdminLogin); // web admin: phone + password (no OTP)
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Phone OTP (account creation + password reset only; NOT for login)
router.post('/send-otp', sendLoginOtp);
router.post('/resend-otp', resendLoginOtp);

// Forgot / Reset Password (phone OTP verifies identity, then user provides new password)
router.post('/reset-password', resetPassword);

// Protected Routes (Require Authentication)
router.get('/me', authenticateToken, getMe);
router.post('/2fa/setup', authenticateToken, setup2FA);
router.post('/2fa/verify', authenticateToken, verify2FASetup);

// Session Management
router.get('/sessions', authenticateToken, getSessions);
router.delete('/sessions/:sessionId', authenticateToken, revokeSession);

export default router;
