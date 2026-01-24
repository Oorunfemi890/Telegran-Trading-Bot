// FILE: src/routes/ea-bridge.routes.ts (UPDATED)
// =============================================

import { Router } from 'express';
import { EABridgeController } from '../controllers/ea-bridge.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const controller = new EABridgeController();

// =============================================
// USER ROUTES (Require authentication)
// =============================================

// Generate new token
router.post('/generate-token', authenticate, (req, res) =>
  controller.generateToken(req, res)
);

// Get user's tokens
router.get('/tokens', authenticate, (req, res) =>
  controller.getTokens(req, res)
);

// Get connection status
router.get('/status', authenticate, (req, res) =>
  controller.getStatus(req, res)
);

// ✅ UPDATED: Revoke token (marks as revoked, doesn't delete)
router.delete('/tokens/:id/revoke', authenticate, (req, res) =>
  controller.revokeToken(req, res)
);

// ✅ NEW: Reactivate revoked token
router.post('/tokens/:id/reactivate', authenticate, (req, res) =>
  controller.reactivateToken(req, res)
);

// ✅ NEW: Permanently delete token
router.delete('/tokens/:id', authenticate, (req, res) =>
  controller.deleteToken(req, res)
);

// =============================================
// EA ROUTES (Use EA token authentication)
// =============================================

// Get pending trade instructions
router.get('/instructions', (req, res) =>
  controller.getInstructions(req, res)
);

// Report execution result
router.post('/report', (req, res) =>
  controller.reportExecution(req, res)
);

// EA heartbeat/ping
router.post('/ping', (req, res) =>
  controller.ping(req, res)
);

// =============================================
// ADMIN ROUTES
// =============================================

// Get connected EAs count
router.get('/connected-count', authenticate, (req, res) =>
  controller.getConnectedCount(req, res)
);

export default router;