// FILE: src/handlers/stoploss.handler.ts
// =============================================
// PHASE 9: STOP LOSS HANDLER
// =============================================

import AppDataSource from '../config/database.config';
import { Trade } from '../database/entities/Trade.entity';
import { Position } from '../database/entities/Position.entity';
import { User } from '../database/entities/User.entity';
import { UserSettings } from '../database/entities/UserSettings.entity';
import { EmailService } from '../services/email.service';
import { TradeDirection, PositionStatus, CloseReason, TradeStatus } from '../types';

export class StopLossHandler {
  private tradeRepo = AppDataSource.getRepository(Trade);
  private positionRepo = AppDataSource.getRepository(Position);
  private userRepo = AppDataSource.getRepository(User);
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Check if any positions have hit their stop loss
   */
  async checkStopLoss(trade: Trade, currentPrice: number): Promise<void> {
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );

    for (const position of openPositions) {
      const slHit = this.isStopLossHit(
        trade.direction,
        currentPrice,
        position.currentStopLoss
      );

      if (slHit) {
        await this.executeStopLoss(trade, position, currentPrice);
      }
    }
  }

  /**
   * Check if stop loss is hit
   */
  private isStopLossHit(
    direction: TradeDirection,
    currentPrice: number,
    stopLoss: number
  ): boolean {
    if (direction === TradeDirection.BUY) {
      return currentPrice <= stopLoss;
    } else {
      return currentPrice >= stopLoss;
    }
  }

  /**
   * Execute stop loss closure
   */
  private async executeStopLoss(
    trade: Trade,
    position: Position,
    currentPrice: number
  ): Promise<void> {
    const isBreakeven = position.breakevenActivated;
    const stopLossType = isBreakeven ? 'Breakeven' : 'Original';

    console.log(`\n⚠️  STOP LOSS HIT!`);
    console.log(`   Trade: ${trade.id}`);
    console.log(`   Position: ${position.positionNumber}`);
    console.log(`   Type: ${stopLossType}`);
    console.log(`   SL Level: ${position.currentStopLoss.toFixed(5)}`);
    console.log(`   Current: ${currentPrice.toFixed(5)}\n`);

    // Calculate loss (or breakeven)
    const loss = this.calculateProfit(
      position.entryPrice,
      position.currentStopLoss,
      position.lotSize,
      trade.direction
    );

    // Update position
    position.status = PositionStatus.CLOSED;
    position.closedPrice = currentPrice;
    position.profit = loss;
    position.closeReason = isBreakeven ? CloseReason.BREAKEVEN_SL : CloseReason.SL;
    position.closedAt = new Date();

    await this.positionRepo.save(position);

    console.log(`   ${isBreakeven ? '🔄' : '❌'} Result: ${loss >= 0 ? '+' : ''}$${loss.toFixed(2)}`);
    console.log(`   ${isBreakeven ? 'Breakeven protected - No loss!' : 'Stop loss executed'}\n`);

    // TODO: Call MetaTrader API to close position (it closes automatically, but we log it)
    // This is informational since MT automatically closes at SL

    // Update trade
    trade.grossProfit += loss;
    trade.netProfit = trade.grossProfit - trade.commissions;
    await this.tradeRepo.save(trade);

    // Check if all positions are now closed
    const remainingOpen = trade.positions.filter(
      p => p.status === PositionStatus.OPEN
    ).length;

    if (remainingOpen === 0) {
      // Trade is complete
      trade.status = TradeStatus.CLOSED;
      trade.closedAt = new Date();
      await this.tradeRepo.save(trade);

      console.log(`✅ All positions closed - trade complete\n`);

      // Send SL notification
      await this.sendStopLossNotification(trade, isBreakeven, Math.abs(loss));
    }
  }

  /**
   * Calculate profit/loss
   */
  private calculateProfit(
    entryPrice: number,
    exitPrice: number,
    lotSize: number,
    direction: TradeDirection
  ): number {
    const pipSize = 0.01; // Simplified
    const pipValue = 1; // $1 per pip per 0.01 lot

    const pips =
      direction === TradeDirection.BUY
        ? (exitPrice - entryPrice) / pipSize
        : (entryPrice - exitPrice) / pipSize;

    return pips * lotSize * pipValue;
  }

  /**
   * Send stop loss notification
   */
  private async sendStopLossNotification(
    trade: Trade,
    isBreakeven: boolean,
    lossAmount: number
  ): Promise<void> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: trade.user_id },
      });

      if (!user) {
        console.log('⚠️  User not found for SL notification');
        return;
      }

      const settings = await this.settingsRepo.findOne({
        where: { user_id: user.id },
      });

      if (!settings || !settings.stopLossNotification) {
        console.log('ℹ️  SL notifications disabled for user');
        return;
      }

      const positionsClosed = trade.positions.filter(
        p => p.status === PositionStatus.CLOSED
      ).length;

      await this.emailService.sendStopLossHitEmail(
        {
          userName: user.fullName,
          symbol: trade.symbol,
          direction: trade.direction,
          stopLossType: isBreakeven ? 'breakeven' : 'original',
          lossAmount,
          positionsClosed,
          tradeId: trade.id,
          accountBalance: 10000, // TODO: Get from trading account
          riskPercentage: settings.balanceUsagePercentage,
        },
        user.id,
        user.email
      );

      console.log('📧 Stop loss notification sent');
    } catch (error) {
      console.error('⚠️  Failed to send SL notification:', error);
    }
  }

  /**
   * Get stop loss statistics
   */
  async getStopLossStats(
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

    const originalSLHits = trades.filter(t =>
      t.positions.some(p => p.closeReason === 'sl')
    ).length;

    const breakevenSLHits = trades.filter(t =>
      t.positions.some(p => p.closeReason === 'breakeven_sl')
    ).length;

    const totalSLHits = originalSLHits + breakevenSLHits;

    // Calculate total amount saved by breakeven
    let breakevenSavings = 0;
    for (const trade of trades) {
      for (const position of trade.positions) {
        if (position.closeReason === 'breakeven_sl') {
          // Calculate what would have been lost
          const originalSL = trade.stopLoss;
          const pipSize = 0.01;
          const pipValue = 1;
          
          const pips = trade.direction === TradeDirection.BUY
            ? (position.entryPrice - originalSL) / pipSize
            : (originalSL - position.entryPrice) / pipSize;
          
          const potentialLoss = pips * position.lotSize * pipValue;
          breakevenSavings += Math.abs(potentialLoss);
        }
      }
    }

    return {
      totalStopLossHits: totalSLHits,
      originalStopLossHits: originalSLHits,
      breakevenStopLossHits: breakevenSLHits,
      breakevenSavings,
      breakevenProtectionRate: totalSLHits > 0 
        ? (breakevenSLHits / totalSLHits) * 100 
        : 0,
    };
  }

  /**
   * Calculate average loss per stop loss hit
   */
  async getAverageLossPerStopLoss(userId: string): Promise<number> {
    const trades = await this.tradeRepo.find({
      where: { user_id: userId },
      relations: ['positions'],
    });

    const losses: number[] = [];

    for (const trade of trades) {
      for (const position of trade.positions) {
        if (position.closeReason === 'sl' && position.profit < 0) {
          losses.push(Math.abs(position.profit));
        }
      }
    }

    return losses.length > 0 
      ? losses.reduce((a, b) => a + b, 0) / losses.length 
      : 0;
  }

  /**
   * Get trailing stop statistics (for advanced users)
   */
  async getTrailingStopPerformance(userId: string) {
    // TODO: Implement when trailing stops are added
    return {
      tradesWithTrailingStop: 0,
      averageTrailingProfit: 0,
      trailingStopEfficiency: 0,
    };
  }

  /**
   * Emergency: Manually close position at stop loss
   */
  async manualStopLossClose(
    positionId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const position = await this.positionRepo.findOne({
      where: { id: positionId },
      relations: ['trade'],
    });

    if (!position) {
      throw new Error('Position not found');
    }

    if (position.trade.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    if (position.status === PositionStatus.CLOSED) {
      throw new Error('Position already closed');
    }

    // Get current price (would come from MT)
    const currentPrice = position.currentStopLoss;

    const loss = this.calculateProfit(
      position.entryPrice,
      currentPrice,
      position.lotSize,
      position.trade.direction
    );

    position.status = PositionStatus.CLOSED;
    position.closedPrice = currentPrice;
    position.profit = loss;
    position.closeReason = CloseReason.MANUAL;
    position.closedAt = new Date();

    await this.positionRepo.save(position);

    console.log(`✅ Position ${position.positionNumber} manually closed at stop loss`);
    console.log(`   Reason: ${reason || 'Manual closure'}`);
    console.log(`   Result: ${loss >= 0 ? '+' : ''}$${loss.toFixed(2)}`);
  }
}