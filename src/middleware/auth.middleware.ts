import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { ModuleName } from '../config/modules';

declare global {
  namespace Express {
    interface Request {
      user?: any;
      tenantId?: string;
    }
  }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, process.env.JWT_SECRET!, (err, user: any) => {
    if (err) {
      // If it fails, maybe it's a super admin token? We should check that if needed, 
      // but typically we can use a separate middleware for super admin or check both.
      jwt.verify(token, process.env.SUPERADMIN_JWT_SECRET!, (err2, adminUser: any) => {
        if (err2) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = adminUser;
        next();
      });
      return;
    }

    req.user = user;
    req.tenantId = user.tenant_id;
    next();
  });
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Module-level permission gate for coordinators.
// OWNER / SUPER_ADMIN always pass; COORDINATOR must have permissions[module] === true.
// Permissions are read fresh from DB so owner changes apply without re-login.
export const requireModule = (module: ModuleName) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Access token missing' });

      if (user.role === 'OWNER' || user.role === 'SUPER_ADMIN') return next();

      if (user.role !== 'COORDINATOR') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const coord = await prisma.coordinator.findUnique({
        where: { coordinator_id: user.sub },
        select: { permissions: true, status: true },
      });

      if (!coord || coord.status !== 'active') {
        return res.status(403).json({ error: 'Coordinator inactive or not found' });
      }

      const perms = (coord.permissions ?? {}) as Record<string, boolean>;
      if (perms[module] !== true) {
        return res.status(403).json({ error: `Missing module permission: ${module}` });
      }

      next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
};
