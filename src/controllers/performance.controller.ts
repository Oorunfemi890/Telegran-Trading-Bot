// FILE: src/controllers/performance.controller.ts (NEW)
// =============================================

import { Request, Response } from 'express';
import { TradeService } from '../services/trade.service';

const tradeService = new TradeService();

export class PerformanceController {
  /**
   * Get performance data for user
   * GET /api/v1/trades/performance
   */
  async getPerformanceData(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const range = req.query.range as string || '30d';
      
      // Calculate date range
      const days = parseInt(range.replace('d', '')) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get trade stats
      const stats = await tradeService.getUserTradeStats(req.userId, {
        start: startDate,
        end: endDate,
      });

      // Get trades for detailed breakdown
      const trades = await tradeService.getUserTrades(req.userId, {
        sortBy: 'closedAt',
        sortOrder: 'DESC',
      });

      // Group by symbol
      const bySymbol: any = {};
      trades.forEach(trade => {
        if (!bySymbol[trade.symbol]) {
          bySymbol[trade.symbol] = {
            symbol: trade.symbol,
            trades: 0,
            wins: 0,
            losses: 0,
            profit: 0,
          };
        }

        bySymbol[trade.symbol].trades++;
        if (trade.netProfit > 0) bySymbol[trade.symbol].wins++;
        if (trade.netProfit < 0) bySymbol[trade.symbol].losses++;
        bySymbol[trade.symbol].profit += trade.netProfit;
      });

      const bySymbolArray = Object.values(bySymbol).map((item: any) => ({
        ...item,
        winRate: item.trades > 0 ? (item.wins / item.trades) * 100 : 0,
      }));

      // Calculate recent performance (daily)
      const recentPerformance: any[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const dayTrades = trades.filter(t => {
          if (!t.closedAt) return false;
          const closedDate = new Date(t.closedAt);
          closedDate.setHours(0, 0, 0, 0);
          return closedDate.getTime() === date.getTime();
        });

        recentPerformance.push({
          date: date.toISOString().split('T')[0],
          profit: dayTrades.reduce((sum, t) => sum + t.netProfit, 0),
          trades: dayTrades.length,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          overview: {
            totalProfit: stats.netProfit,
            totalTrades: stats.totalTrades,
            winRate: stats.winRate,
            profitFactor: stats.profitFactor,
            averageWin: stats.averageWin,
            averageLoss: stats.averageLoss,
            largestWin: stats.largestWin,
            largestLoss: stats.largestLoss,
          },
          bySymbol: bySymbolArray,
          recentPerformance,
        },
      });
    } catch (error: any) {
      console.error('Get performance data error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch performance data',
      });
    }
  }
}