// FILE: src/routes/ea-bridge.routes.ts
// =============================================
// EA Bridge Routes
// =============================================

import { Router } from 'express';
import { EABridgeController } from '../controllers/ea-bridge.controller';
import { authenticate } from '../middleware/auth.middleware';
import { apiRateLimit } from '../middleware/rateLimit.middleware';

const router = Router();
const eaBridgeController = new EABridgeController();

// =============================================
// USER ENDPOINTS (Authenticated)
// =============================================

// Generate new EA token
router.post(
  '/generate-token',
  authenticate,
  apiRateLimit,
  (req, res) => eaBridgeController.generateToken(req, res)
);

// Get EA connection status
router.get(
  '/status',
  authenticate,
  apiRateLimit,
  (req, res) => eaBridgeController.getStatus(req, res)
);

// Get all user tokens
router.get(
  '/tokens',
  authenticate,
  apiRateLimit,
  (req, res) => eaBridgeController.getTokens(req, res)
);

// Revoke EA token
router.delete(
  '/tokens/:id',
  authenticate,
  apiRateLimit,
  (req, res) => eaBridgeController.revokeToken(req, res)
);

// =============================================
// EA ENDPOINTS (Token-based auth)
// =============================================

// Get trade instructions (polled by EA)
router.get(
  '/instructions',
  apiRateLimit,
  (req, res) => eaBridgeController.getInstructions(req, res)
);

// Report execution result
router.post(
  '/report',
  apiRateLimit,
  (req, res) => eaBridgeController.reportExecution(req, res)
);

// EA heartbeat/ping
router.post(
  '/ping',
  (req, res) => eaBridgeController.ping(req, res)
);

export default router;