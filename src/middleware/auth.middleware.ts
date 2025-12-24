// =============================================
// FILE: src/middleware/auth.middleware.ts
// =============================================
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../helpers/jwt.helper';
import { JWTPayload, UserRole } from '../types';
import AppDataSource from '../database/data-source';
import { User } from '../database/entities/User.entity';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userId?: string;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);
    
    // Check if user still exists
    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: decoded.userId },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Check if user is active
    if (!user.isActive()) {
      res.status(403).json({
        success: false,
        message: 'Account is suspended or inactive',
      });
      return;
    }

    // Attach user info to request
    req.user = decoded;
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

// Optional authentication (doesn't fail if no token)
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyAccessToken(token);
      req.user = decoded;
      req.userId = decoded.userId;
    }
    
    next();
  } catch (error) {
    // Token invalid, but continue anyway
    next();
  }
};