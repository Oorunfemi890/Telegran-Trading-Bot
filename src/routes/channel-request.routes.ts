// ===================================================
// FILE: src/routes/channel-request.routes.ts (NEW)
// ===================================================

import { Router } from 'express';
import { ChannelRequestController } from '../controllers/channel-request.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { apiRateLimit } from '../middleware/rateLimit.middleware';

const router = Router();
const controller = new ChannelRequestController();

// User routes
router.post(
  '/',
  authenticate,
  apiRateLimit,
  (req, res) => controller.submitRequest(req, res)
);

router.get(
  '/my-requests',
  authenticate,
  apiRateLimit,
  (req, res) => controller.getUserRequests(req, res)
);

// Admin routes
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  apiRateLimit,
  (req, res) => controller.getAllRequests(req, res)
);

router.get(
  '/admin/pending-count',
  authenticate,
  requireAdmin,
  apiRateLimit,
  (req, res) => controller.getPendingCount(req, res)
);

router.post(
  '/admin/:id/approve',
  authenticate,
  requireAdmin,
  apiRateLimit,
  (req, res) => controller.approveRequest(req, res)
);

router.post(
  '/admin/:id/reject',
  authenticate,
  requireAdmin,
  apiRateLimit,
  (req, res) => controller.rejectRequest(req, res)
);

export default router;