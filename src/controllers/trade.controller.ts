// FILE: src/controllers/trade.controller.ts
// =============================================
// PHASE 8: TRADE CONTROLLER
// =============================================

import { Request, Response } from 'express';
import { TradeService } from '../services/trade.service';
import { TradeStatus } from '../types';

const tradeService = new TradeService();

export class TradeController {
  /**
   * Get all trades for current user
   * GET /api/v1/trades
   */
  async getUserTrades(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { status, limit, offset, sortBy, sortOrder } = req.query;

      const trades = await tradeService.getUserTrades(req.userId, {
        status: status as TradeStatus,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
      });

      res.status(200).json({
        success: true,
        data: trades,
        meta: {
          total: trades.length,
        },
      });
    } catch (error: any) {
      console.error('Get user trades error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch trades',
      });
    }
  }

  /**
   * Get single trade by ID
   * GET /api/v1/trades/:id
   */
  async getTradeById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { id } = req.params;

      const trade = await tradeService.getTradeById(id, req.userId);

      res.status(200).json({
        success: true,
        data: trade,
      });
    } catch (error: any) {
      console.error('Get trade by ID error:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'Trade not found',
      });
    }
  }

  /**
   * Get active trades
   * GET /api/v1/trades/active
   */
  async getActiveTrades(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const trades = await tradeService.getActiveTrades(req.userId);

      res.status(200).json({
        success: true,
        data: trades,
        meta: {
          total: trades.length,
        },
      });
    } catch (error: any) {
      console.error('Get active trades error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch active trades',
      });
    }
  }

  /**
   * Get trade statistics
   * GET /api/v1/trades/stats
   */
  async getTradeStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { startDate, endDate } = req.query;

      const dateRange = startDate && endDate
        ? {
            start: new Date(startDate as string),
            end: new Date(endDate as string),
          }
        : undefined;

      const stats = await tradeService.getUserTradeStats(req.userId, dateRange);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      console.error('Get trade stats error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch trade statistics',
      });
    }
  }

  /**
   * Get trade history with pagination
   * GET /api/v1/trades/history
   */
  async getTradeHistory(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await tradeService.getTradeHistory(req.userId, page, limit);

      res.status(200).json({
        success: true,
        data: result.trades,
        meta: result.pagination,
      });
    } catch (error: any) {
      console.error('Get trade history error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch trade history',
      });
    }
  }

  /**
   * Get positions for a trade
   * GET /api/v1/trades/:id/positions
   */
  async getTradePositions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { id } = req.params;

      const positions = await tradeService.getTradePositions(id, req.userId);

      res.status(200).json({
        success: true,
        data: positions,
        meta: {
          total: positions.length,
        },
      });
    } catch (error: any) {
      console.error('Get trade positions error:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'Failed to fetch positions',
      });
    }
  }

  /**
   * Manually close a trade (emergency)
   * POST /api/v1/trades/:id/close
   */
  async manuallyCloseTrade(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { id } = req.params;

      const trade = await tradeService.manuallyCloseTrade(id, req.userId);

      res.status(200).json({
        success: true,
        message: 'Trade closed manually',
        data: trade,
      });
    } catch (error: any) {
      console.error('Manually close trade error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to close trade',
      });
    }
  }

  /**
   * Get today's trades
   * GET /api/v1/trades/today
   */
  async getTodaysTrades(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const trades = await tradeService.getTodaysTrades(req.userId);

      res.status(200).json({
        success: true,
        data: trades,
        meta: {
          total: trades.length,
        },
      });
    } catch (error: any) {
      console.error('Get today trades error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch today\'s trades',
      });
    }
  }

  /**
   * Get recent trades
   * GET /api/v1/trades/recent
   */
  async getRecentTrades(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;

      const trades = await tradeService.getRecentTrades(req.userId, limit);

      res.status(200).json({
        success: true,
        data: trades,
        meta: {
          total: trades.length,
        },
      });
    } catch (error: any) {
      console.error('Get recent trades error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch recent trades',
      });
    }
  }
}