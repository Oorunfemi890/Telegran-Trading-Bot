// =============================================
// FILE: src/routes/auth.routes.ts
// =============================================
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rateLimit.middleware';

const router = Router();
const authController = new AuthController();

/**
 * Public routes (no authentication required)
 */

// POST /api/v1/auth/register
router.post(
  '/register',
  authRateLimit,
  (req, res) => authController.register(req, res)
);

// POST /api/v1/auth/login
router.post(
  '/login',
  authRateLimit,
  (req, res) => authController.login(req, res)
);

// GET /api/v1/auth/verify-email/:token
router.get(
  '/verify-email/:token',
  (req, res) => authController.verifyEmail(req, res)
);

// POST /api/v1/auth/forgot-password
router.post(
  '/forgot-password',
  authRateLimit,
  (req, res) => authController.forgotPassword(req, res)
);

// POST /api/v1/auth/reset-password
router.post(
  '/reset-password',
  authRateLimit,
  (req, res) => authController.resetPassword(req, res)
);

// POST /api/v1/auth/validate-invitation
router.post(
  '/validate-invitation',
  (req, res) => authController.validateInvitation(req, res)
);

/**
 * Protected routes (authentication required)
 */

// GET /api/v1/auth/profile
router.get(
  '/profile',
  authenticate,
  (req, res) => authController.getProfile(req, res)
);

export default router;