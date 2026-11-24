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
  verifyLoginOtp
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Public Routes
router.post('/signup', signup);
router.post('/login', tenantLogin); // Accepts password OR firebaseIdToken
router.post('/login/verify-2fa', verify2FALogin);
router.post('/admin/login', superAdminLogin);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Phone + OTP login (dev: 9876543210 / 123456)
router.post('/send-otp', sendLoginOtp);
router.post('/resend-otp', resendLoginOtp);
router.post('/verify-otp', verifyLoginOtp);

// Forgot / Reset Password (Firebase OTP verifies identity, then user provides new password)
router.post('/reset-password', resetPassword);

// Protected Routes (Require Authentication)
router.post('/2fa/setup', authenticateToken, setup2FA);
router.post('/2fa/verify', authenticateToken, verify2FASetup);

// Session Management
router.get('/sessions', authenticateToken, getSessions);
router.delete('/sessions/:sessionId', authenticateToken, revokeSession);

export default router;
