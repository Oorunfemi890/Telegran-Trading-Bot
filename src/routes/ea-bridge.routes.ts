// FILE: src/routes/ea-bridge.routes.ts (UPDATED WITH DOWNLOAD)
// =============================================
// EA Bridge Routes with Download
// =============================================

import { Router } from 'express';
import { EABridgeController } from '../controllers/ea-bridge.controller';
import { authenticate } from '../middleware/auth.middleware';
import { apiRateLimit } from '../middleware/rateLimit.middleware';
import path from 'path';
import fs from 'fs';

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

// ✅ NEW: Download EA file
router.get(
  '/download',
  authenticate,
  (req, res) => {
    try {
      const platform = req.query.platform as string || 'MT5';
      
      // Determine file path based on platform
      const fileName = platform === 'MT4' ? 'TradingBotEA.ex4' : 'TradingBotEA.ex5';
      const filePath = path.join(__dirname, '../../assets/ea', fileName);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'EA file not found. Please contact support.',
        });
      }

      // Set headers for download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // Send file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      console.error('EA download error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download EA file',
      });
    }
  }
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