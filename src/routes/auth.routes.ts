// FILE: src/routes/auth.routes.ts
// =============================================
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimit, registrationRateLimit } from '../middleware/rateLimit.middleware';

const router = Router();
const authController = new AuthController();

/**
 * Public routes (no authentication required)
 */

// POST /api/v1/auth/register
// Rate limit: 100 registrations per minute (generous for bulk onboarding)
router.post(
  '/register',
  registrationRateLimit,
  (req, res) => authController.register(req, res)
);

// POST /api/v1/auth/login
// Rate limit: 50 attempts per 15 minutes (was 5, now much more generous)
router.post(
  '/login',
  authRateLimit,
  (req, res) => authController.login(req, res)
);

// PUT /api/v1/auth/change-password
router.put(
  '/change-password',
  authenticate,
  authRateLimit,
  (req, res) => authController.changePassword(req, res)
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
// No rate limit - customers need to check if their code is valid
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