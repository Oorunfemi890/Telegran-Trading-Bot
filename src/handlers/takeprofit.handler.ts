// FILE: src/handlers/takeprofit.handler.ts
// =============================================
// PHASE 9: TAKE PROFIT HANDLER
// =============================================

import AppDataSource from '../config/database.config';
import { Trade } from '../database/entities/Trade.entity';
import { Position } from '../database/entities/Position.entity';
import { User } from '../database/entities/User.entity';
import { UserSettings } from '../database/entities/UserSettings.entity';
import { EmailService } from '../services/email.service';
import { TradeDirection, PositionStatus, CloseReason } from '../types';

export class TakeProfitHandler {
  private tradeRepo = AppDataSource.getRepository(Trade);
  private positionRepo = AppDataSource.getRepository(Position);
  private userRepo = AppDataSource.getRepository(User);
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Check if any take profit levels have been reached
   */
  async checkTakeProfits(trade: Trade, currentPrice: number): Promise<void> {
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );

    if (openPositions.length === 0) {
      return;
    }

    // Check each TP level in order
    for (const tp of trade.takeProfits) {
      const tpReached = this.isTakeProfitReached(
        trade.direction,
        currentPrice,
        tp.price
      );

      if (tpReached) {
        // Check if we haven't already closed positions for this TP
        const alreadyClosed = trade.positions.filter(
          p => p.closeReason === `tp${tp.level}` as CloseReason
        ).length;

        const positionsToClose = tp.positions - alreadyClosed;

        if (positionsToClose > 0) {
          await this.executeTakeProfit(
            trade,
            tp,
            currentPrice,
            openPositions,
            positionsToClose
          );
        }
      }
    }
  }

  /**
   * Check if take profit level is reached
   */
  private isTakeProfitReached(
    direction: TradeDirection,
    currentPrice: number,
    tpPrice: number
  ): boolean {
    if (direction === TradeDirection.BUY) {
      return currentPrice >= tpPrice;
    } else {
      return currentPrice <= tpPrice;
    }
  }

  /**
   * Execute take profit closure
   */
  private async executeTakeProfit(
    trade: Trade,
    tp: any,
    currentPrice: number,
    openPositions: Position[],
    positionsToClose: number
  ): Promise<void> {
    console.log(`\n💰 TAKE PROFIT ${tp.level} HIT!`);
    console.log(`   Trade: ${trade.id}`);
    console.log(`   Target: ${tp.price.toFixed(5)}`);
    console.log(`   Current: ${currentPrice.toFixed(5)}`);
    console.log(`   Closing: ${positionsToClose} position(s)\n`);

    // Sort positions by profitability (close most profitable first)
    const sortedPositions = this.sortPositionsByProfit(
      openPositions,
      currentPrice,
      trade.direction
    );

    let totalProfit = 0;
    const closedPositions: Position[] = [];

    // Close the specified number of positions
    for (let i = 0; i < Math.min(positionsToClose, sortedPositions.length); i++) {
      const position = sortedPositions[i];

      const profit = this.calculateProfit(
        position.entryPrice,
        currentPrice,
        position.lotSize,
        trade.direction
      );

      // Update position
      position.status = PositionStatus.CLOSED;
      position.closedPrice = currentPrice;
      position.profit = profit;
      position.closeReason = `tp${tp.level}` as CloseReason;
      position.closedAt = new Date();

      await this.positionRepo.save(position);

      totalProfit += profit;
      closedPositions.push(position);

      console.log(`   ✅ Position ${position.positionNumber}:`);
      console.log(`      Entry: ${position.entryPrice.toFixed(5)}`);
      console.log(`      Exit: ${currentPrice.toFixed(5)}`);
      console.log(`      Profit: +$${profit.toFixed(2)}`);

      // TODO: Call MetaTrader API to close position
      // await this.closePosition(position.mtOrderTicket);
    }

    // Update trade
    trade.grossProfit += totalProfit;
    trade.netProfit = trade.grossProfit - trade.commissions;
    await this.tradeRepo.save(trade);

    const remainingOpen = openPositions.length - closedPositions.length;

    console.log(`\n💰 Total profit from TP${tp.level}: +$${totalProfit.toFixed(2)}`);
    console.log(`📊 Positions remaining: ${remainingOpen}\n`);

    // Send notification
    await this.sendTakeProfitNotification(
      trade,
      tp.level,
      tp.price,
      closedPositions.length,
      remainingOpen,
      totalProfit
    );
  }

  /**
   * Sort positions by profitability (most profitable first)
   */
  private sortPositionsByProfit(
    positions: Position[],
    currentPrice: number,
    direction: TradeDirection
  ): Position[] {
    return [...positions].sort((a, b) => {
      const profitA = this.calculateProfit(
        a.entryPrice,
        currentPrice,
        a.lotSize,
        direction
      );
      const profitB = this.calculateProfit(
        b.entryPrice,
        currentPrice,
        b.lotSize,
        direction
      );
      return profitB - profitA; // Highest profit first
    });
  }

  /**
   * Calculate profit for a position
   */
  private calculateProfit(
    entryPrice: number,
    exitPrice: number,
    lotSize: number,
    direction: TradeDirection
  ): number {
    const pipSize = 0.01; // Simplified (should come from symbol specs)
    const pipValue = 1; // $1 per pip per 0.01 lot

    const pips =
      direction === TradeDirection.BUY
        ? (exitPrice - entryPrice) / pipSize
        : (entryPrice - exitPrice) / pipSize;

    return pips * lotSize * pipValue;
  }

  /**
   * Send take profit notification
   */
  private async sendTakeProfitNotification(
    trade: Trade,
    tpLevel: number,
    tpPrice: number,
    positionsClosed: number,
    positionsRemaining: number,
    profitFromTP: number
  ): Promise<void> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: trade.user_id },
      });

      if (!user) {
        console.log('⚠️  User not found for TP notification');
        return;
      }

      const settings = await this.settingsRepo.findOne({
        where: { user_id: user.id },
      });

      if (!settings || !settings.takeProfitNotification) {
        console.log('ℹ️  TP notifications disabled for user');
        return;
      }

      await this.emailService.sendTakeProfitHitEmail(
        {
          userName: user.fullName,
          symbol: trade.symbol,
          direction: trade.direction,
          tpLevel,
          tpPrice,
          positionsClosed,
          positionsRemaining,
          profitFromTP,
          totalProfit: trade.grossProfit,
          tradeId: trade.id,
        },
        user.id,
        user.email
      );

      console.log('📧 Take profit notification sent');
    } catch (error) {
      console.error('⚠️  Failed to send TP notification:', error);
    }
  }

  /**
   * Get take profit achievement statistics
   */
  async getTakeProfitStats(
    userId: string,
    dateRange?: { start: Date; end: Date }
  ) {
    const query = this.tradeRepo
      .createQueryBuilder('trade')
      .leftJoinAndSelect('trade.positions', 'positions')
      .where('trade.user_id = :userId', { userId });

    if (dateRange) {
      query.andWhere('trade.closedAt BETWEEN :start AND :end', dateRange);
    }

    const trades = await query.getMany();

    const tp1Hits = trades.filter(t =>
      t.positions.some(p => p.closeReason === 'tp1')
    ).length;

    const tp2Hits = trades.filter(t =>
      t.positions.some(p => p.closeReason === 'tp2')
    ).length;

    const tp3Hits = trades.filter(t =>
      t.positions.some(p => p.closeReason === 'tp3')
    ).length;

    return {
      totalTrades: trades.length,
      tp1Achievements: tp1Hits,
      tp2Achievements: tp2Hits,
      tp3Achievements: tp3Hits,
      tp1Rate: trades.length > 0 ? (tp1Hits / trades.length) * 100 : 0,
      tp2Rate: trades.length > 0 ? (tp2Hits / trades.length) * 100 : 0,
      tp3Rate: trades.length > 0 ? (tp3Hits / trades.length) * 100 : 0,
    };
  }

  /**
   * Calculate average pips captured per TP level
   */
  async getAveragePipsPerTP(userId: string): Promise<{
    tp1AvgPips: number;
    tp2AvgPips: number;
    tp3AvgPips: number;
  }> {
    const trades = await this.tradeRepo.find({
      where: { user_id: userId },
      relations: ['positions'],
    });

    const tp1Pips: number[] = [];
    const tp2Pips: number[] = [];
    const tp3Pips: number[] = [];

    for (const trade of trades) {
      for (const position of trade.positions) {
        if (position.closeReason === 'tp1' && position.closedPrice) {
          const pips = this.calculatePips(
            position.entryPrice,
            position.closedPrice,
            trade.direction
          );
          tp1Pips.push(pips);
        } else if (position.closeReason === 'tp2' && position.closedPrice) {
          const pips = this.calculatePips(
            position.entryPrice,
            position.closedPrice,
            trade.direction
          );
          tp2Pips.push(pips);
        } else if (position.closeReason === 'tp3' && position.closedPrice) {
          const pips = this.calculatePips(
            position.entryPrice,
            position.closedPrice,
            trade.direction
          );
          tp3Pips.push(pips);
        }
      }
    }

    return {
      tp1AvgPips: tp1Pips.length > 0 
        ? tp1Pips.reduce((a, b) => a + b, 0) / tp1Pips.length 
        : 0,
      tp2AvgPips: tp2Pips.length > 0 
        ? tp2Pips.reduce((a, b) => a + b, 0) / tp2Pips.length 
        : 0,
      tp3AvgPips: tp3Pips.length > 0 
        ? tp3Pips.reduce((a, b) => a + b, 0) / tp3Pips.length 
        : 0,
    };
  }

  /**
   * Calculate pips between two prices
   */
  private calculatePips(
    entryPrice: number,
    exitPrice: number,
    direction: TradeDirection
  ): number {
    const pipSize = 0.01;
    
    if (direction === TradeDirection.BUY) {
      return (exitPrice - entryPrice) / pipSize;
    } else {
      return (entryPrice - exitPrice) / pipSize;
    }
  }
}