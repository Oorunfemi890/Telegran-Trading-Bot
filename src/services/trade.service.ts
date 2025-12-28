// FILE: src/services/trade.service.ts
// =============================================
// PHASE 8: TRADE SERVICE (CRUD OPERATIONS)
// =============================================

import AppDataSource from '../config/database.config';
import { Trade } from '../database/entities/Trade.entity';
import { Position } from '../database/entities/Position.entity';
import { User } from '../database/entities/User.entity';
import { TradeStatus } from '../types';
import { Between, In } from 'typeorm';

export class TradeService {
  private tradeRepo = AppDataSource.getRepository(Trade);
  private positionRepo = AppDataSource.getRepository(Position);
  private userRepo = AppDataSource.getRepository(User);

  /**
   * Get all trades for a user
   */
  async getUserTrades(
    userId: string,
    options?: {
      status?: TradeStatus;
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'closedAt';
      sortOrder?: 'ASC' | 'DESC';
    }
  ) {
    const query = this.tradeRepo
      .createQueryBuilder('trade')
      .leftJoinAndSelect('trade.positions', 'positions')
      .leftJoinAndSelect('trade.signal', 'signal')
      .leftJoinAndSelect('signal.channel', 'channel')
      .where('trade.user_id = :userId', { userId });

    if (options?.status) {
      query.andWhere('trade.status = :status', { status: options.status });
    }

    if (options?.sortBy) {
      query.orderBy(
        `trade.${options.sortBy}`,
        options.sortOrder || 'DESC'
      );
    } else {
      query.orderBy('trade.createdAt', 'DESC');
    }

    if (options?.limit) {
      query.take(options.limit);
    }

    if (options?.offset) {
      query.skip(options.offset);
    }

    return await query.getMany();
  }

  /**
   * Get single trade by ID
   */
  async getTradeById(tradeId: string, userId: string) {
    const trade = await this.tradeRepo.findOne({
      where: { id: tradeId, user_id: userId },
      relations: ['positions', 'signal', 'signal.channel', 'tradingAccount'],
    });

    if (!trade) {
      throw new Error('Trade not found');
    }

    return trade;
  }

  /**
   * Get active trades for a user
   */
  async getActiveTrades(userId: string) {
    return await this.tradeRepo.find({
      where: { user_id: userId, status: TradeStatus.OPEN },
      relations: ['positions', 'signal'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get trade statistics for a user
   */
  async getUserTradeStats(userId: string, dateRange?: { start: Date; end: Date }) {
    const query = this.tradeRepo
      .createQueryBuilder('trade')
      .where('trade.user_id = :userId', { userId })
      .andWhere('trade.status = :status', { status: TradeStatus.CLOSED });

    if (dateRange) {
      query.andWhere('trade.closedAt BETWEEN :start AND :end', {
        start: dateRange.start,
        end: dateRange.end,
      });
    }

    const trades = await query.getMany();

    const winningTrades = trades.filter((t) => t.netProfit > 0);
    const losingTrades = trades.filter((t) => t.netProfit < 0);
    const breakevenTrades = trades.filter((t) => t.netProfit === 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.netProfit, 0);
    const totalLoss = Math.abs(
      losingTrades.reduce((sum, t) => sum + t.netProfit, 0)
    );

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      breakevenTrades: breakevenTrades.length,
      winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      totalProfit,
      totalLoss,
      netProfit: totalProfit - totalLoss,
      averageWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit,
      largestWin: Math.max(...winningTrades.map((t) => t.netProfit), 0),
      largestLoss: Math.abs(Math.min(...losingTrades.map((t) => t.netProfit), 0)),
    };
  }

  /**
   * Get trade history with pagination
   */
  async getTradeHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const [trades, total] = await this.tradeRepo.findAndCount({
      where: { user_id: userId },
      relations: ['positions', 'signal', 'signal.channel'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: (page - 1) * limit,
    });

    return {
      trades,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get positions for a trade
   */
  async getTradePositions(tradeId: string, userId: string) {
    const trade = await this.getTradeById(tradeId, userId);

    return await this.positionRepo.find({
      where: { trade_id: trade.id },
      order: { positionNumber: 'ASC' },
    });
  }

  /**
   * Manually close a trade (emergency)
   */
  async manuallyCloseTrade(tradeId: string, userId: string) {
    const trade = await this.getTradeById(tradeId, userId);

    if (trade.status !== TradeStatus.OPEN) {
      throw new Error('Trade is not open');
    }

    // Close all open positions
    const openPositions = trade.positions.filter(
      (p) => p.status === 'open'
    );

    for (const position of openPositions) {
      position.status = 'closed' as any;
      position.closedAt = new Date();
      position.closeReason = 'manual' as any;
      await this.positionRepo.save(position);
    }

    // Update trade
    trade.status = TradeStatus.CLOSED;
    trade.closedAt = new Date();
    await this.tradeRepo.save(trade);

    return trade;
  }

  /**
   * Get today's trades
   */
  async getTodaysTrades(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return await this.tradeRepo.find({
      where: {
        user_id: userId,
        createdAt: Between(today, tomorrow),
      },
      relations: ['positions', 'signal'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get recent trades (last N)
   */
  async getRecentTrades(userId: string, limit: number = 10) {
    return await this.tradeRepo.find({
      where: { user_id: userId },
      relations: ['positions', 'signal', 'signal.channel'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Delete trade (admin only - for testing)
   */
  async deleteTrade(tradeId: string) {
    // Delete positions first
    await this.positionRepo.delete({ trade_id: tradeId });
    
    // Delete trade
    await this.tradeRepo.delete({ id: tradeId });
    
    return { success: true };
  }
}