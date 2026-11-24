import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { generateSecret, verify, generateURI } from 'otplib';
import QRCode from 'qrcode';
import { prisma, getTenantPrisma } from '../config/prisma';
import { redis } from '../config/redis';
import { getAuth } from '../config/firebase';
import { sendOtp, verifyOtp } from '../services/otp.service';
import { ok, fail } from '../utils/response';

// Helper to generate tokens
const generateTokens = (payload: object, isSuperAdmin: boolean) => {
  const secret = isSuperAdmin ? process.env.SUPERADMIN_JWT_SECRET || 'supersecret' : process.env.JWT_SECRET || 'tenantsecret';
  const accessToken = jwt.sign(payload, secret, { expiresIn: '1h' });
  
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'refreshsecret';
  const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: '7d' });

  return { accessToken, refreshToken };
};

// Helper to store session in Redis
const storeSession = async (userId: string, refreshToken: string, device: string, ip: string) => {
  const sessionId = `session:${userId}:${Date.now()}`;
  const sessionData = { refreshToken, device, ip, createdAt: new Date().toISOString() };
  // Store for 7 days
  await redis.set(sessionId, JSON.stringify(sessionData), 'EX', 7 * 24 * 60 * 60);
};

// --- Tenant Authentication (Owner, Coordinator, Student) ---

export const signup = async (req: Request, res: Response) => {
  try {
    const { name, password, subscriptionPlanId, firebaseIdToken } = req.body;
    
    if (!name || !password || !firebaseIdToken) {
      return res.status(400).json({ error: 'Name, password, and firebaseIdToken are required' });
    }

    let verifiedContact: string;
    try {
      const decodedToken = await getAuth().verifyIdToken(firebaseIdToken);
      if (!decodedToken.phone_number) {
        return res.status(400).json({ error: 'Firebase token does not contain a phone number' });
      }
      verifiedContact = decodedToken.phone_number;
    } catch (fbErr) {
      return res.status(401).json({ error: 'Invalid or expired Firebase ID Token' });
    }

    const existingOwner = await prisma.owner.findUnique({ where: { contact: verifiedContact } });
    if (existingOwner) {
      return res.status(409).json({ error: 'Contact already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newOwner = await prisma.owner.create({
      data: {
        name,
        contact: verifiedContact,
        password: hashedPassword,
        subscriptionPlanId,
      }
    });

    res.status(201).json({ message: 'Owner registered successfully', tenant_id: newOwner.tenant_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create owner account' });
  }
};

export const tenantLogin = async (req: Request, res: Response) => {
  try {
    const { contact, password, role, firebaseIdToken, device } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    let searchContact = contact;
    let isFirebaseLogin = false;

    // 1. If Firebase Token is provided, use it to extract the verified phone number
    if (firebaseIdToken) {
      try {
        const decodedToken = await getAuth().verifyIdToken(firebaseIdToken);
        if (!decodedToken.phone_number) {
          return res.status(400).json({ error: 'Firebase token does not contain a phone number' });
        }
        searchContact = decodedToken.phone_number;
        isFirebaseLogin = true;
      } catch (fbErr) {
        return res.status(401).json({ error: 'Invalid Firebase ID Token' });
      }
    } else if (!contact || !password) {
      return res.status(400).json({ error: 'Missing contact/password or firebaseIdToken' });
    }

    let user;
    let tenantId;
    let userId;

    if (role === 'OWNER') {
      user = await prisma.owner.findUnique({ where: { contact: searchContact } });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      tenantId = user.tenant_id;
      userId = user.tenant_id;
    } else if (role === 'COORDINATOR') {
      const coordinators = await prisma.coordinator.findMany({ where: { mobile: searchContact } });
      if (coordinators.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
      user = coordinators[0];
      tenantId = user.tenant_id;
      userId = user.coordinator_id;
    } else if (role === 'STUDENT') {
      const students = await prisma.student.findMany({ where: { mobile: searchContact } });
      if (students.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
      user = students[0];
      tenantId = user.tenant_id;
      userId = user.student_id;
    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // 2. Verify password only if not logging in via Firebase OTP
    if (!isFirebaseLogin) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch && password !== user.password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // 3. 2FA Check (Applies to both Password and OTP logins if enabled)
    if ('twoFaEnabled' in user && user.twoFaEnabled) {
      const tempToken = jwt.sign({ sub: userId, role, tenant_id: tenantId, isTemp: true }, process.env.JWT_SECRET || 'tenantsecret', { expiresIn: '10m' });
      return res.json({ message: '2FA required', tempToken });
    }

    const payload = { sub: userId, tenant_id: tenantId, role };
    const tokens = generateTokens(payload, false);
    
    // Store session in Redis
    await storeSession(userId, tokens.refreshToken, device || 'Unknown Device', req.ip || 'Unknown IP');

    // Log activity
    await getTenantPrisma(tenantId).activityLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: userId,
        role: role,
        action: 'login',
        device: device || 'Unknown Device'
      }
    });

    res.json({ message: 'Login successful', ...tokens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { firebaseIdToken, newPassword, role } = req.body;
    if (!firebaseIdToken || !newPassword || !role) {
      return res.status(400).json({ error: 'firebaseIdToken, newPassword, and role are required' });
    }

    const decodedToken = await getAuth().verifyIdToken(firebaseIdToken);
    const verifiedPhone = decodedToken.phone_number;
    if (!verifiedPhone) return res.status(400).json({ error: 'Firebase token has no phone number' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (role === 'OWNER') {
      const owner = await prisma.owner.findUnique({ where: { contact: verifiedPhone } });
      if (!owner) return res.status(404).json({ error: 'User not found' });
      await prisma.owner.update({ where: { tenant_id: owner.tenant_id }, data: { password: hashedPassword } });
    } else if (role === 'COORDINATOR') {
      const coordinators = await prisma.coordinator.findMany({ where: { mobile: verifiedPhone } });
      if (!coordinators.length) return res.status(404).json({ error: 'User not found' });
      await prisma.coordinator.update({ where: { coordinator_id: coordinators[0].coordinator_id }, data: { password: hashedPassword } });
    } else {
      return res.status(400).json({ error: 'Role not supported for password reset' });
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const userId = req.user.sub;
    const keys = await redis.keys(`session:${userId}:*`);
    const sessions = [];

    for (const key of keys) {
      const data = await redis.get(key);
      if (data) {
        sessions.push({ sessionId: key, ...JSON.parse(data) });
      }
    }

    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

export const revokeSession = async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const userId = req.user.sub as string;
    
    // Ensure the session belongs to the user
    if (!sessionId.startsWith(`session:${userId}:`)) {
      return res.status(403).json({ error: 'Unauthorized to revoke this session' });
    }

    await redis.del(sessionId);
    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke session' });
  }
};

export const verify2FALogin = async (req: Request, res: Response) => {
  try {
    const { tempToken, token, device } = req.body;
    if (!tempToken || !token) return res.status(400).json({ error: 'tempToken and token are required' });

    const decoded: any = jwt.verify(tempToken, process.env.JWT_SECRET || 'tenantsecret');
    if (!decoded.isTemp) return res.status(400).json({ error: 'Invalid temp token' });

    let user;
    if (decoded.role === 'SUPER_ADMIN') {
      user = await prisma.superAdminUser.findUnique({ where: { admin_id: decoded.sub } });
    } else if (decoded.role === 'OWNER') {
      user = await prisma.owner.findUnique({ where: { tenant_id: decoded.tenant_id } });
    } else {
      return res.status(400).json({ error: 'Role not supported for 2FA yet' });
    }

    if (!user || !user.twoFaSecret) return res.status(400).json({ error: '2FA not properly configured' });

    const result = await verify({ token, secret: user.twoFaSecret });
    if (!result.valid) return res.status(401).json({ error: 'Invalid 2FA token' });

    const payload = { sub: decoded.sub, tenant_id: decoded.tenant_id, role: decoded.role };
    const tokens = generateTokens(payload, decoded.role === 'SUPER_ADMIN');

    if (decoded.tenant_id) {
      await storeSession(decoded.sub, tokens.refreshToken, device || 'Unknown Device', req.ip || 'Unknown IP');
      await getTenantPrisma(decoded.tenant_id).activityLog.create({
        data: {
          tenant_id: decoded.tenant_id,
          actor_id: decoded.sub,
          role: decoded.role,
          action: 'login',
        }
      });
    }

    res.json({ message: 'Login successful', ...tokens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
};

export const setup2FA = async (req: Request, res: Response) => {
  try {
    const userId = req.user.sub;
    const role = req.user.role;

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'SmartLibrary',
      label: userId,
      secret
    });
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    if (role === 'SUPER_ADMIN') {
      await prisma.superAdminUser.update({
        where: { admin_id: userId },
        data: { twoFaSecret: secret }
      });
    } else if (role === 'OWNER') {
      await prisma.owner.update({
        where: { tenant_id: req.user.tenant_id },
        data: { twoFaSecret: secret }
      });
    } else {
      return res.status(403).json({ error: 'Role not supported for 2FA' });
    }

    res.json({ secret, qrCodeUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
};

export const verify2FASetup = async (req: Request, res: Response) => {
  try {
    const userId = req.user.sub;
    const role = req.user.role;
    const { token } = req.body;

    let user;
    if (role === 'SUPER_ADMIN') {
      user = await prisma.superAdminUser.findUnique({ where: { admin_id: userId } });
    } else if (role === 'OWNER') {
      user = await prisma.owner.findUnique({ where: { tenant_id: req.user.tenant_id } });
    }

    if (!user || !user.twoFaSecret) return res.status(400).json({ error: 'No 2FA setup found' });

    const result = await verify({ token, secret: user.twoFaSecret });
    if (!result.valid) return res.status(400).json({ error: 'Invalid token' });

    if (role === 'SUPER_ADMIN') {
      await prisma.superAdminUser.update({ where: { admin_id: userId }, data: { twoFaEnabled: true } });
    } else if (role === 'OWNER') {
      await prisma.owner.update({ where: { tenant_id: req.user.tenant_id }, data: { twoFaEnabled: true } });
    }

    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify 2FA setup' });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ error: 'Refresh token required' });

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'refreshsecret';
    const decoded: any = jwt.verify(token, refreshSecret);

    const payload = { sub: decoded.sub, tenant_id: decoded.tenant_id, role: decoded.role };
    const tokens = generateTokens(payload, decoded.role === 'SUPER_ADMIN');

    res.json(tokens);
  } catch (err) {
    res.status(403).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully (Remove token on client side)' });
};

// --- Super Admin Authentication ---

export const superAdminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const admin = await prisma.superAdminUser.findUnique({ where: { email } });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch && password !== admin.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (admin.twoFaEnabled) {
      const tempToken = jwt.sign({ sub: admin.admin_id, role: admin.role, isTemp: true }, process.env.SUPERADMIN_JWT_SECRET || 'supersecret', { expiresIn: '10m' });
      return res.json({ message: '2FA required', tempToken });
    }

    const payload = { sub: admin.admin_id, role: admin.role };
    const tokens = generateTokens(payload, true);

    res.json({ message: 'Super Admin Login successful', ...tokens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Phone + OTP Login (dev: 9876543210 / 123456) ---

export const sendLoginOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return fail(res, 'phone is required', 400, 'VALIDATION_FAILED');

    const result = await sendOtp(String(phone));
    if (!result.ok) {
      const status =
        result.code === 'RESEND_COOLDOWN' || result.code === 'RATE_LIMITED' ? 429 : 400;
      return fail(res, result.message, status, result.code);
    }
    return ok(res, { devOtp: (result as any).devOtp ?? null }, result.message);
  } catch (err) {
    console.error(err);
    return fail(res, 'Failed to send OTP', 500);
  }
};

export const resendLoginOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return fail(res, 'phone is required', 400, 'VALIDATION_FAILED');

    const result = await sendOtp(String(phone));
    if (!result.ok) {
      const status =
        result.code === 'RESEND_COOLDOWN' || result.code === 'RATE_LIMITED' ? 429 : 400;
      return fail(res, result.message, status, result.code);
    }
    return ok(res, { devOtp: (result as any).devOtp ?? null }, result.message);
  } catch (err) {
    console.error(err);
    return fail(res, 'Failed to resend OTP', 500);
  }
};

export const verifyLoginOtp = async (req: Request, res: Response) => {
  try {
    const { phone, otp, device } = req.body;
    if (!phone || !otp) {
      return fail(res, 'phone and otp are required', 400, 'VALIDATION_FAILED');
    }

    const check = await verifyOtp(String(phone), String(otp));
    if (!check.ok) {
      const status = check.code === 'OTP_EXPIRED' ? 400 : 401;
      return fail(res, check.message, status, check.code);
    }

    // Owner lookup by contact = phone
    const owner = await prisma.owner.findUnique({ where: { contact: String(phone) } });
    if (!owner) {
      return fail(res, 'Owner not found for this phone number', 404, 'OWNER_NOT_FOUND');
    }

    const payload = { sub: owner.tenant_id, tenant_id: owner.tenant_id, role: 'OWNER' };
    const tokens = generateTokens(payload, false);

    await storeSession(owner.tenant_id, tokens.refreshToken, device || 'OTP Device', req.ip || 'Unknown IP');

    await getTenantPrisma(owner.tenant_id).activityLog.create({
      data: {
        tenant_id: owner.tenant_id,
        actor_id: owner.tenant_id,
        role: 'OWNER',
        action: 'login',
        device: device || 'OTP Device',
      },
    });

    const libraryCount = await prisma.library.count({ where: { tenant_id: owner.tenant_id } });

    return ok(res, {
      ...tokens,
      user: {
        tenant_id: owner.tenant_id,
        name: owner.name,
        contact: owner.contact,
        role: 'OWNER',
      },
      isSetupComplete: libraryCount > 0,
      isProfileComplete: true,
    }, 'Login successful');
  } catch (err) {
    console.error(err);
    return fail(res, 'Internal server error', 500);
  }
};
