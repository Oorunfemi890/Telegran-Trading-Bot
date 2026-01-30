// FILE: src/routes/trade.routes.ts
// =============================================
// PHASE 8: TRADE ROUTES
// =============================================

import { Router } from "express";
import { TradeController } from "../controllers/trade.controller";
import { PerformanceController } from "../controllers/performance.controller";
import { authenticate } from "../middleware/auth.middleware";
import { apiRateLimit } from "../middleware/rateLimit.middleware";

const router = Router();
const tradeController = new TradeController();
const performanceController = new PerformanceController();

/**
 * All routes require authentication
 */

// GET /api/v1/trades - Get all trades
router.get("/", authenticate, apiRateLimit, (req, res) =>
  tradeController.getUserTrades(req, res)
);

// GET /api/v1/trades/active - Get active trades
router.get("/active", authenticate, apiRateLimit, (req, res) =>
  tradeController.getActiveTrades(req, res)
);

// GET /api/v1/trades/stats - Get trade statistics
router.get("/stats", authenticate, apiRateLimit, (req, res) =>
  tradeController.getTradeStats(req, res)
);

// GET /api/v1/trades/history - Get trade history with pagination
router.get("/history", authenticate, apiRateLimit, (req, res) =>
  tradeController.getTradeHistory(req, res)
);

// GET /api/v1/trades/today - Get today's trades
router.get("/today", authenticate, apiRateLimit, (req, res) =>
  tradeController.getTodaysTrades(req, res)
);

// GET /api/v1/trades/recent - Get recent trades
router.get("/recent", authenticate, apiRateLimit, (req, res) =>
  tradeController.getRecentTrades(req, res)
);

// GET /api/v1/trades/performance - Get performance analytics
router.get("/performance", authenticate, apiRateLimit, (req, res) =>
  performanceController.getPerformanceData(req, res)
);

// GET /api/v1/trades/:id - Get single trade
router.get("/:id", authenticate, apiRateLimit, (req, res) =>
  tradeController.getTradeById(req, res)
);

// GET /api/v1/trades/:id/positions - Get trade positions
router.get("/:id/positions", authenticate, apiRateLimit, (req, res) =>
  tradeController.getTradePositions(req, res)
);

// POST /api/v1/trades/:id/close - Manually close trade
router.post("/:id/close", authenticate, apiRateLimit, (req, res) =>
  tradeController.manuallyCloseTrade(req, res)
);

export default router;
