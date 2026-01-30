// FILE: src/routes/signal.routes.ts
// =============================================
// SIGNAL ROUTES - NEW FILE
// =============================================

import { Router } from 'express';
import { SignalController } from '../controllers/signal.controller';
import { authenticate } from '../middleware/auth.middleware';
import { apiRateLimit } from '../middleware/rateLimit.middleware';

const router = Router();
const signalController = new SignalController();

/**
 * All routes require authentication
 */

// GET /api/v1/signals - Get user's signals with pagination
router.get(
  '/',
  authenticate,
  apiRateLimit,
  (req, res) => signalController.getUserSignals(req, res)
);

// GET /api/v1/signals/:id - Get single signal
router.get(
  '/:id',
  authenticate,
  apiRateLimit,
  (req, res) => signalController.getSignalById(req, res)
);

export default router;