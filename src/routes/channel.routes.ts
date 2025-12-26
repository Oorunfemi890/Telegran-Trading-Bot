// FILE: src/routes/channel.routes.ts
// =============================================
import { Router } from 'express';
import { ChannelController } from '../controllers/channel.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/role.middleware';
import { apiRateLimit } from '../middleware/rateLimit.middleware';

const router = Router();
const channelController = new ChannelController();

/**
 * Public routes (with authentication)
 */

// GET /api/v1/channels - Get all channels
router.get(
  '/',
  authenticate,
  apiRateLimit,
  (req, res) => channelController.getAllChannels(req, res)
);

// GET /api/v1/channels/my-subscriptions - Get user's subscribed channels
router.get(
  '/my-subscriptions',
  authenticate,
  apiRateLimit,
  (req, res) => channelController.getMyChannels(req, res)
);

// GET /api/v1/channels/:id - Get channel by ID
router.get(
  '/:id',
  authenticate,
  apiRateLimit,
  (req, res) => channelController.getChannelById(req, res)
);

// GET /api/v1/channels/:id/performance - Get channel performance
router.get(
  '/:id/performance',
  authenticate,
  apiRateLimit,
  (req, res) => channelController.getChannelPerformance(req, res)
);

// POST /api/v1/channels/:id/subscribe - Subscribe to channel
router.post(
  '/:id/subscribe',
  authenticate,
  apiRateLimit,
  (req, res) => channelController.subscribeToChannel(req, res)
);

// POST /api/v1/channels/:id/unsubscribe - Unsubscribe from channel
router.post(
  '/:id/unsubscribe',
  authenticate,
  apiRateLimit,
  (req, res) => channelController.unsubscribeFromChannel(req, res)
);

/**
 * Admin-only routes
 */

// POST /api/v1/channels - Add new channel
router.post(
  '/',
  authenticate,
  requireAdmin,
  apiRateLimit,
  (req, res) => channelController.addChannel(req, res)
);

// PUT /api/v1/channels/:id - Update channel
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  apiRateLimit,
  (req, res) => channelController.updateChannel(req, res)
);

// DELETE /api/v1/channels/:id - Delete channel
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  apiRateLimit,
  (req, res) => channelController.deleteChannel(req, res)
);

export default router;