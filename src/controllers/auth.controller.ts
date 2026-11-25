import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { prisma, getTenantPrisma } from '../config/prisma';
import { redis } from '../config/redis';
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
    const { name, password, subscriptionPlanId, contact, otp } = req.body;

    if (!name || !password || !contact || !otp) {
      return res.status(400).json({ error: 'name, password, contact, and otp are required' });
    }

    // Verify phone OTP (dev allowlist; SMS gateway later)
    const check = await verifyOtp(String(contact), String(otp));
    if (!check.ok) {
      const status = check.code === 'OTP_EXPIRED' ? 400 : 401;
      return res.status(status).json({ error: check.message });
    }

    const existingOwner = await prisma.owner.findUnique({ where: { contact: String(contact) } });
    if (existingOwner) {
      return res.status(409).json({ error: 'Contact already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newOwner = await prisma.owner.create({
      data: {
        name,
        contact: String(contact),
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
    const { contact, password, role, device } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }
    if (!contact || !password) {
      return res.status(400).json({ error: 'contact and password are required (OTP login: use /send-otp + /verify-otp)' });
    }

    const searchContact = contact;

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

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2FA Check (Applies to password logins if enabled)
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

    // Coordinator: include module permissions so the app can gate UI immediately
    const permissions = role === 'COORDINATOR' ? ((user as any).permissions ?? {}) : undefined;
    res.json({
      message: 'Login successful',
      ...tokens,
      ...(permissions !== undefined ? { permissions } : {}),
      user: { sub: userId, tenant_id: tenantId, role, ...(permissions !== undefined ? { permissions } : {}) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { phone, otp, newPassword, role } = req.body;
    if (!phone || !otp || !newPassword || !role) {
      return res.status(400).json({ error: 'phone, otp, newPassword, and role are required' });
    }

    // Verify phone OTP (dev allowlist; SMS gateway later)
    const check = await verifyOtp(String(phone), String(otp));
    if (!check.ok) {
      const status = check.code === 'OTP_EXPIRED' ? 400 : 401;
      return res.status(status).json({ error: check.message });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (role === 'OWNER') {
      const owner = await prisma.owner.findUnique({ where: { contact: String(phone) } });
      if (!owner) return res.status(404).json({ error: 'User not found' });
      await prisma.owner.update({ where: { tenant_id: owner.tenant_id }, data: { password: hashedPassword } });
    } else if (role === 'COORDINATOR') {
      const coordinators = await prisma.coordinator.findMany({ where: { mobile: String(phone) } });
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

    const valid = authenticator.verify({ token, secret: user.twoFaSecret });
    if (!valid) return res.status(401).json({ error: 'Invalid 2FA token' });

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

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userId, 'SmartLibrary', secret);
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

    const valid = authenticator.verify({ token, secret: user.twoFaSecret });
    if (!valid) return res.status(400).json({ error: 'Invalid token' });

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
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'phone and password are required' });
    }

    const admin = await prisma.superAdminUser.findUnique({ where: { phone: String(phone) } });
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
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

// --- Phone OTP (account creation + password reset only; login is password-based) ---

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

// GET /api/auth/me - current user from verified JWT
export const getMe = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');

    // Coordinator: load current module permissions (owner may have changed them since login)
    let permissions: Record<string, boolean> | undefined;
    if (user.role === 'COORDINATOR' && user.sub) {
      const coord = await prisma.coordinator.findUnique({
        where: { coordinator_id: user.sub },
        select: { permissions: true },
      });
      permissions = (coord?.permissions as Record<string, boolean>) ?? {};
    }

    return ok(res, {
      sub: user.sub ?? user.admin_id ?? user.tenant_id,
      tenant_id: user.tenant_id,
      role: user.role,
      name: user.name,
      contact: user.contact ?? user.phone,
      isSetupComplete: user.isSetupComplete,
      isProfileComplete: user.isProfileComplete,
      ...(permissions !== undefined ? { permissions } : {}),
    }, 'Current user');
  } catch {
    return fail(res, 'Internal server error', 500);
  }
};
