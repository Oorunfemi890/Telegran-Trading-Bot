// ===================================================
// FILE: src/middleware/role.middleware.ts
// ===================================================

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userId || !req.userRole) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  const allowedRoles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
  
  if (!allowedRoles.includes(req.userRole as UserRole)) {
    console.log(`❌ Access denied: User has role '${req.userRole}' but needs admin`);
    res.status(403).json({
      success: false,
      message: 'Admin access required',
      userRole: req.userRole,
    });
    return;
  }

  console.log(`✅ Admin access granted: ${req.userRole}`);
  next();
};

export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.userId || !req.userRole) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  if (req.userRole !== UserRole.SUPER_ADMIN) {
    console.log(`❌ Access denied: User has role '${req.userRole}' but needs super_admin`);
    res.status(403).json({
      success: false,
      message: 'Super Admin access required',
      userRole: req.userRole,
    });
    return;
  }

  console.log(`✅ Super Admin access granted`);
  next();
};