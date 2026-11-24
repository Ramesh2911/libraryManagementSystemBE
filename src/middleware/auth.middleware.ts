import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
