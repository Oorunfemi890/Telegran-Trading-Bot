// FILE: src/services/admin/system-metrics.service.ts
// =============================================
// PHASE 11: SYSTEM METRICS SERVICE
// =============================================

import AppDataSource from '../../config/database.config';
import { User } from '../../database/entities/User.entity';
import { Trade } from '../../database/entities/Trade.entity';
import { Signal } from '../../database/entities/Signal.entity';
import { TelegramChannel } from '../../database/entities/TelegramChannel.entity';
import { TradeStatus, SignalStatus } from '../../types';
import { Between } from 'typeorm';
import { getRedisClient } from '../../config/redis.config';

export class SystemMetricsService {
  private userRepo = AppDataSource.getRepository(User);
  private tradeRepo = AppDataSource.getRepository(Trade);
  private signalRepo = AppDataSource.getRepository(Signal);
  private channelRepo = AppDataSource.getRepository(TelegramChannel);

  /**
   * Get comprehensive system metrics
   */
  async getSystemMetrics(): Promise<any> {
    const [
      userMetrics,
      tradingMetrics,
      signalMetrics,
      performanceMetrics,
      systemHealth,
    ] = await Promise.all([
      this.getUserMetrics(),
      this.getTradingMetrics(),
      this.getSignalMetrics(),
      this.getPerformanceMetrics(),
      this.getSystemHealth(),
    ]);

    return {
      timestamp: new Date(),
      users: userMetrics,
      trading: tradingMetrics,
      signals: signalMetrics,
      performance: performanceMetrics,
      system: systemHealth,
    };
  }

  /**
   * Get user metrics
   */
  private async getUserMetrics() {
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { status: 'active' as any } }),
      this.getUsersRegisteredInPeriod(1),
      this.getUsersRegisteredInPeriod(7),
      this.getUsersRegisteredInPeriod(30),
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      newToday: newUsersToday,
      newThisWeek: newUsersThisWeek,
      newThisMonth: newUsersThisMonth,
      growthRate: this.calculateGrowthRate(newUsersThisMonth, totalUsers),
    };
  }

  /**
   * Get trading metrics
   */
  private async getTradingMetrics() {
    const [
      totalTrades,
      activeTrades,
      todayTrades,
      todayProfit,
      weekProfit,
      monthProfit,
    ] = await Promise.all([
      this.tradeRepo.count(),
      this.tradeRepo.count({ where: { status: TradeStatus.OPEN } }),
      this.getTradesInPeriod(1),
      this.getProfitInPeriod(1),
      this.getProfitInPeriod(7),
      this.getProfitInPeriod(30),
    ]);

    return {
      total: totalTrades,
      active: activeTrades,
      todayCount: todayTrades,
      profitToday: todayProfit,
      profitThisWeek: weekProfit,
      profitThisMonth: monthProfit,
    };
  }

  /**
   * Get signal metrics
   */
  private async getSignalMetrics() {
    const [
      totalSignals,
      activeSignals,
      todaySignals,
      totalChannels,
      activeChannels,
    ] = await Promise.all([
      this.signalRepo.count(),
      this.signalRepo.count({ where: { status: SignalStatus.ACTIVE } }),
      this.getSignalsInPeriod(1),
      this.channelRepo.count(),
      this.channelRepo.count({ where: { isActive: true } }),
    ]);

    return {
      total: totalSignals,
      active: activeSignals,
      todayCount: todaySignals,
      channels: {
        total: totalChannels,
        active: activeChannels,
      },
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics() {
    const trades = await this.tradeRepo.find({
      where: { status: TradeStatus.CLOSED },
      take: 1000,
      order: { closedAt: 'DESC' },
    });

    const winningTrades = trades.filter(t => t.netProfit > 0);
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.netProfit, 0);
    const totalLoss = Math.abs(
      trades.filter(t => t.netProfit < 0).reduce((sum, t) => sum + t.netProfit, 0)
    );

    return {
      totalTrades: trades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalProfit,
      totalLoss,
      netProfit: totalProfit - totalLoss,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
      averageProfit: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
    };
  }

  /**
   * Get system health metrics
   */
  private async getSystemHealth() {
    const redis = getRedisClient();
    
    return {
      database: {
        connected: true,
        responseTime: await this.getDatabaseResponseTime(),
      },
      redis: {
        connected: redis !== null && redis.status === 'ready',
        memory: redis ? await this.getRedisMemory() : null,
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
      cpu: process.cpuUsage(),
    };
  }

  /**
   * Helper: Get users registered in last N days
   */
  private async getUsersRegisteredInPeriod(days: number): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    return await this.userRepo.count({
      where: {
        createdAt: Between(date, new Date()),
      },
    });
  }

  /**
   * Helper: Get trades in last N days
   */
  private async getTradesInPeriod(days: number): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    return await this.tradeRepo.count({
      where: {
        createdAt: Between(date, new Date()),
      },
    });
  }

  /**
   * Helper: Get profit in last N days
   */
  private async getProfitInPeriod(days: number): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    const trades = await this.tradeRepo.find({
      where: {
        closedAt: Between(date, new Date()),
        status: TradeStatus.CLOSED,
      },
    });

    return trades.reduce((sum, t) => sum + t.netProfit, 0);
  }

  /**
   * Helper: Get signals in last N days
   */
  private async getSignalsInPeriod(days: number): Promise<number> {
    const date = new Date();
    date.setDate(date.getDate() - days);

    return await this.signalRepo.count({
      where: {
        createdAt: Between(date, new Date()),
      },
    });
  }

  /**
   * Helper: Calculate growth rate
   */
  private calculateGrowthRate(newUsers: number, totalUsers: number): number {
    if (totalUsers === 0) return 0;
    return (newUsers / totalUsers) * 100;
  }

  /**
   * Helper: Get database response time
   */
  private async getDatabaseResponseTime(): Promise<number> {
    const start = Date.now();
    await this.userRepo.count();
    return Date.now() - start;
  }

  /**
   * Helper: Get Redis memory usage
   */
  private async getRedisMemory(): Promise<number | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
      const info = await redis.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      return match ? parseInt(match[1]) / 1024 / 1024 : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(): Promise<any> {
    const redis = getRedisClient();
    if (!redis) {
      return {
        available: false,
        message: 'Redis not available',
      };
    }

    try {
      const queues = [
        'signal-processing',
        'trade-execution',
        'position-monitoring',
        'email-delivery',
      ];

      const stats: any = {};

      for (const queueName of queues) {
        const [waiting, active, completed, failed] = await Promise.all([
          redis.llen(`bull:${queueName}:wait`),
          redis.llen(`bull:${queueName}:active`),
          redis.zcard(`bull:${queueName}:completed`),
          redis.zcard(`bull:${queueName}:failed`),
        ]);

        stats[queueName] = {
          waiting,
          active,
          completed,
          failed,
          total: waiting + active,
        };
      }

      return {
        available: true,
        queues: stats,
      };
    } catch (error) {
      return {
        available: false,
        error: (error as Error).message,
      };
    }
  }
}