// FILE: src/routes/admin/analytics.routes.ts
// =============================================
// PHASE 11: ADMIN ANALYTICS ROUTES (COMPLETE)
// =============================================

import { Router } from 'express';
import { AdminAnalyticsController } from '../../controllers/admin/analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { apiRateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();
const analyticsController = new AdminAnalyticsController();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// GET /api/v1/admin/analytics/system
router.get(
  '/system',
  apiRateLimit,
  (req, res) => analyticsController.getSystemAnalytics(req, res)
);

// GET /api/v1/admin/analytics/trends
router.get(
  '/trends',
  apiRateLimit,
  (req, res) => analyticsController.getPerformanceTrends(req, res)
);

// GET /api/v1/admin/analytics/dashboard
router.get(
  '/dashboard',
  apiRateLimit,
  (req, res) => analyticsController.getRealTimeDashboard(req, res)
);

export default router;