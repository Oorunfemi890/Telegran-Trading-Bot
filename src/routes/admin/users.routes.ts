// FILE: src/routes/admin/users.routes.ts
// =============================================
// PHASE 11: ADMIN USERS ROUTES
// =============================================

import { Router } from 'express';
import { AdminUsersController } from '../../controllers/admin/users.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../../middleware/role.middleware';
import { apiRateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();
const usersController = new AdminUsersController();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/v1/admin/users - Get all users with filters
router.get(
  '/',
  apiRateLimit,
  (req, res) => usersController.getAllUsers(req, res)
);

// GET /api/v1/admin/users/statistics - Get system-wide user statistics
router.get(
  '/statistics',
  apiRateLimit,
  (req, res) => usersController.getSystemStatistics(req, res)
);

// GET /api/v1/admin/users/:id - Get single user with details
router.get(
  '/:id',
  apiRateLimit,
  (req, res) => usersController.getUserById(req, res)
);

// GET /api/v1/admin/users/:id/statistics - Get user-specific statistics
router.get(
  '/:id/statistics',
  apiRateLimit,
  (req, res) => usersController.getUserStatistics(req, res)
);

// PUT /api/v1/admin/users/:id - Update user
router.put(
  '/:id',
  apiRateLimit,
  (req, res) => usersController.updateUser(req, res)
);

// POST /api/v1/admin/users/:id/suspend - Suspend user
router.post(
  '/:id/suspend',
  apiRateLimit,
  (req, res) => usersController.suspendUser(req, res)
);

// POST /api/v1/admin/users/:id/activate - Activate user
router.post(
  '/:id/activate',
  apiRateLimit,
  (req, res) => usersController.activateUser(req, res)
);

// POST /api/v1/admin/users/:id/extend-subscription - Extend subscription
router.post(
  '/:id/extend-subscription',
  apiRateLimit,
  (req, res) => usersController.extendSubscription(req, res)
);

// POST /api/v1/admin/users/:id/change-tier - Change subscription tier
router.post(
  '/:id/change-tier',
  apiRateLimit,
  (req, res) => usersController.changeUserTier(req, res)
);

// POST /api/v1/admin/users/:id/promote - Promote to admin (super admin only)
router.post(
  '/:id/promote',
  requireSuperAdmin,
  apiRateLimit,
  (req, res) => usersController.promoteToAdmin(req, res)
);

// POST /api/v1/admin/users/:id/demote - Demote admin (super admin only)
router.post(
  '/:id/demote',
  requireSuperAdmin,
  apiRateLimit,
  (req, res) => usersController.demoteToUser(req, res)
);

// DELETE /api/v1/admin/users/:id - Delete user
router.delete(
  '/:id',
  requireSuperAdmin,
  apiRateLimit,
  (req, res) => usersController.deleteUser(req, res)
);

export default router;