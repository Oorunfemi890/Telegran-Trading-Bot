// FILE: src/services/admin/analytics.service.ts
// =============================================
// PHASE 11: ADMIN ANALYTICS SERVICE
// =============================================

import AppDataSource from '../../config/database.config';
import { Trade } from '../../database/entities/Trade.entity';
import { Signal } from '../../database/entities/Signal.entity';
import { User } from '../../database/entities/User.entity';
import { TelegramChannel } from '../../database/entities/TelegramChannel.entity';
import { TradeStatus, SignalStatus } from '../../types';
import { Between } from 'typeorm';

export class AdminAnalyticsService {
  private tradeRepo = AppDataSource.getRepository(Trade);
  private signalRepo = AppDataSource.getRepository(Signal);
  private userRepo = AppDataSource.getRepository(User);
  private channelRepo = AppDataSource.getRepository(TelegramChannel);

  /**
   * Get comprehensive system analytics
   */
  async getSystemAnalytics(dateRange?: { start: Date; end: Date }) {
    const [
      tradingMetrics,
      signalMetrics,
      channelPerformance,
      financialMetrics,
      userActivityMetrics,
    ] = await Promise.all([
      this.getTradingMetrics(dateRange),
      this.getSignalMetrics(dateRange),
      this.getChannelPerformance(dateRange),
      this.getFinancialMetrics(dateRange),
      this.getUserActivityMetrics(dateRange),
    ]);

    return {
      trading: tradingMetrics,
      signals: signalMetrics,
      channels: channelPerformance,
      financial: financialMetrics,
      userActivity: userActivityMetrics,
      timestamp: new Date(),
    };
  }

  /**
   * Get trading metrics
   */
  private async getTradingMetrics(dateRange?: { start: Date; end: Date }) {
    const query = this.tradeRepo.createQueryBuilder('trade');

    if (dateRange) {
      query.where('trade.createdAt BETWEEN :start AND :end', dateRange);
    }

    const [allTrades, openTrades] = await Promise.all([
      query.getMany(),
      this.tradeRepo.count({ where: { status: TradeStatus.OPEN } }),
    ]);

    const closedTrades = allTrades.filter(t => t.status === TradeStatus.CLOSED);
    const winningTrades = closedTrades.filter(t => t.netProfit > 0);
    const losingTrades = closedTrades.filter(t => t.netProfit < 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.netProfit, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netProfit, 0));

    return {
      total: allTrades.length,
      open: openTrades,
      closed: closedTrades.length,
      winning: winningTrades.length,
      losing: losingTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      totalProfit,
      totalLoss,
      netProfit: totalProfit - totalLoss,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit,
      averageTradeDuration: this.calculateAverageDuration(closedTrades),
      breakevenActivations: allTrades.filter(t => t.breakevenActivated).length,
    };
  }

  /**
   * Get signal metrics
   */
  private async getSignalMetrics(dateRange?: { start: Date; end: Date }) {
    const query = this.signalRepo.createQueryBuilder('signal');

    if (dateRange) {
      query.where('signal.createdAt BETWEEN :start AND :end', dateRange);
    }

    const signals = await query.getMany();

    const activeSignals = signals.filter(s => s.status === SignalStatus.ACTIVE);
    const expiredSignals = signals.filter(s => s.status === SignalStatus.EXPIRED);
    const completedSignals = signals.filter(s => s.status === SignalStatus.COMPLETED);

    return {
      total: signals.length,
      active: activeSignals.length,
      expired: expiredSignals.length,
      completed: completedSignals.length,
      averageTradesPerSignal: signals.length > 0 
        ? signals.reduce((sum, s) => sum + s.tradesGenerated, 0) / signals.length 
        : 0,
      mostTradedSymbols: this.getMostTradedSymbols(signals),
    };
  }

  /**
   * Get channel performance
   */
  private async getChannelPerformance(dateRange?: { start: Date; end: Date }) {
    const channels = await this.channelRepo.find({
      relations: ['signals', 'subscriptions'],
    });

    const channelStats = await Promise.all(
      channels.map(async channel => {
        const signals = channel.signals || [];
        
        let filteredSignals = signals;
        if (dateRange) {
          filteredSignals = signals.filter(
            s => s.createdAt >= dateRange.start && s.createdAt <= dateRange.end
          );
        }

        const trades = await this.tradeRepo.find({
          where: {
            signal: { channel_id: channel.id },
            status: TradeStatus.CLOSED,
          },
        });

        const winningTrades = trades.filter(t => t.netProfit > 0);
        const totalProfit = trades.reduce((sum, t) => sum + t.netProfit, 0);

        return {
          channelId: channel.id,
          channelName: channel.title,
          totalSignals: filteredSignals.length,
          tradesGenerated: filteredSignals.reduce((sum, s) => sum + s.tradesGenerated, 0),
          subscribers: channel.subscriptions?.length || 0,
          winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
          totalProfit,
          averageProfitPerTrade: trades.length > 0 ? totalProfit / trades.length : 0,
        };
      })
    );

    return channelStats.sort((a, b) => b.totalProfit - a.totalProfit);
  }

  /**
   * Get financial metrics
   */
  private async getFinancialMetrics(dateRange?: { start: Date; end: Date }) {
    const query = this.tradeRepo.createQueryBuilder('trade')
      .where('trade.status = :status', { status: TradeStatus.CLOSED });

    if (dateRange) {
      query.andWhere('trade.closedAt BETWEEN :start AND :end', dateRange);
    }

    const trades = await query.getMany();

    const winningTrades = trades.filter(t => t.netProfit > 0);
    const losingTrades = trades.filter(t => t.netProfit < 0);

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.netProfit, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netProfit, 0));
    const totalCommissions = trades.reduce((sum, t) => sum + t.commissions, 0);

    return {
      grossProfit,
      grossLoss,
      netProfit: grossProfit - grossLoss,
      totalCommissions,
      largestWin: Math.max(...winningTrades.map(t => t.netProfit), 0),
      largestLoss: Math.abs(Math.min(...losingTrades.map(t => t.netProfit), 0)),
      averageWin: winningTrades.length > 0 ? grossProfit / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? grossLoss / losingTrades.length : 0,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit,
      expectancy: trades.length > 0 ? (grossProfit - grossLoss) / trades.length : 0,
    };
  }

  /**
   * Get user activity metrics
   */
  private async getUserActivityMetrics(dateRange?: { start: Date; end: Date }) {
    const query = this.userRepo.createQueryBuilder('user');

    if (dateRange) {
      query.where('user.createdAt BETWEEN :start AND :end', dateRange);
    }

    const users = await query.getMany();

    const activeUsers = users.filter(u => {
      return u.lastLoginAt && 
             u.lastLoginAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    });

    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      activityRate: users.length > 0 ? (activeUsers.length / users.length) * 100 : 0,
      newRegistrations: users.filter(u => {
        if (!dateRange) return false;
        return u.createdAt >= dateRange.start && u.createdAt <= dateRange.end;
      }).length,
    };
  }

  /**
   * Calculate average trade duration
   */
  private calculateAverageDuration(trades: Trade[]): number {
    const tradesWithDuration = trades.filter(t => t.openedAt && t.closedAt);
    
    if (tradesWithDuration.length === 0) return 0;

    const totalDuration = tradesWithDuration.reduce((sum, t) => {
      const duration = t.closedAt!.getTime() - t.openedAt!.getTime();
      return sum + duration;
    }, 0);

    return totalDuration / tradesWithDuration.length / (1000 * 60 * 60); // Convert to hours
  }

  /**
   * Get most traded symbols
   */
  private getMostTradedSymbols(signals: Signal[]): Array<{ symbol: string; count: number }> {
    const symbolCounts: { [key: string]: number } = {};

    signals.forEach(signal => {
      symbolCounts[signal.symbol] = (symbolCounts[signal.symbol] || 0) + 1;
    });

    return Object.entries(symbolCounts)
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get performance trends (daily breakdown)
   */
  async getPerformanceTrends(days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trades = await this.tradeRepo.find({
      where: {
        closedAt: Between(startDate, endDate),
        status: TradeStatus.CLOSED,
      },
      order: { closedAt: 'ASC' },
    });

    const dailyStats: { [key: string]: any } = {};

    trades.forEach(trade => {
      const date = trade.closedAt!.toISOString().split('T')[0];
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          trades: 0,
          profit: 0,
          winning: 0,
          losing: 0,
        };
      }

      dailyStats[date].trades++;
      dailyStats[date].profit += trade.netProfit;
      
      if (trade.netProfit > 0) {
        dailyStats[date].winning++;
      } else if (trade.netProfit < 0) {
        dailyStats[date].losing++;
      }
    });

    return Object.values(dailyStats).map((day: any) => ({
      ...day,
      winRate: day.trades > 0 ? (day.winning / day.trades) * 100 : 0,
    }));
  }

  /**
   * Get real-time dashboard stats
   */
  async getRealTimeDashboard() {
    const [
      activeTrades,
      todayTrades,
      todayProfit,
      activeUsers,
      pendingSignals,
    ] = await Promise.all([
      this.tradeRepo.count({ where: { status: TradeStatus.OPEN } }),
      this.getTodayTradesCount(),
      this.getTodayProfit(),
      this.getActiveUsersCount(),
      this.signalRepo.count({ where: { status: SignalStatus.ACTIVE } }),
    ]);

    return {
      activeTrades,
      todayTrades,
      todayProfit,
      activeUsers,
      pendingSignals,
      timestamp: new Date(),
    };
  }

  private async getTodayTradesCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.tradeRepo.count({
      where: {
        createdAt: Between(today, tomorrow),
      },
    });
  }

  private async getTodayProfit(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const trades = await this.tradeRepo.find({
      where: {
        closedAt: Between(today, tomorrow),
        status: TradeStatus.CLOSED,
      },
    });

    return trades.reduce((sum, t) => sum + t.netProfit, 0);
  }

  private async getActiveUsersCount(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return await this.userRepo
      .createQueryBuilder('user')
      .where('user.lastLoginAt >= :sevenDaysAgo', { sevenDaysAgo })
      .getCount();
  }
}