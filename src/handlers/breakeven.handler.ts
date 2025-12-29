// FILE: src/handlers/breakeven.handler.ts
// =============================================
// PHASE 9: BREAKEVEN HANDLER
// =============================================

import AppDataSource from '../config/database.config';
import { Trade } from '../database/entities/Trade.entity';
import { Position } from '../database/entities/Position.entity';
import { UserSettings } from '../database/entities/UserSettings.entity';
import { User } from '../database/entities/User.entity';
import { EmailService } from '../services/email.service';
import { TradeDirection, PositionStatus } from '../types';
import { calculatePipDistance } from '../helpers/math.helper';

export class BreakevenHandler {
  private tradeRepo = AppDataSource.getRepository(Trade);
  private positionRepo = AppDataSource.getRepository(Position);
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private userRepo = AppDataSource.getRepository(User);
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Check if breakeven should be activated for a trade
   */
  async checkBreakeven(
    trade: Trade,
    currentPrice: number,
    settings: UserSettings
  ): Promise<boolean> {
    // Skip if already activated
    if (trade.breakevenActivated) {
      return false;
    }

    // Skip if breakeven is disabled
    if (!settings.breakevenEnabled) {
      return false;
    }

    // Get all open positions
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );

    if (openPositions.length === 0) {
      return false;
    }

    // Get the furthest entry price (worst entry)
    const furthestEntry = this.getFurthestEntry(trade, openPositions);

    // Calculate pip distance from furthest entry
    const pipSize = this.getPipSize(trade.symbol);
    const pipsFromEntry = Math.abs(
      calculatePipDistance(currentPrice, furthestEntry, pipSize)
    );

    // Check if threshold is met
    const threshold = settings.breakevenActivationPips;
    
    if (pipsFromEntry >= threshold) {
      console.log(`\n🛡️  BREAKEVEN TRIGGER DETECTED!`);
      console.log(`   Trade: ${trade.id}`);
      console.log(`   Symbol: ${trade.symbol}`);
      console.log(`   Price moved: ${pipsFromEntry.toFixed(1)} pips`);
      console.log(`   Threshold: ${threshold} pips`);

      // Activate breakeven
      await this.activateBreakeven(trade, openPositions, currentPrice);
      
      return true;
    }

    return false;
  }

  /**
   * Activate breakeven for all open positions
   */
  private async activateBreakeven(
    trade: Trade,
    openPositions: Position[],
    currentPrice: number
  ): Promise<void> {
    console.log(`\n📍 Moving stop losses to breakeven...`);

    // Move each position's stop loss to its entry price
    for (const position of openPositions) {
      const oldStopLoss = position.currentStopLoss;
      
      // Move SL to entry price
      position.currentStopLoss = position.entryPrice;
      position.breakevenActivated = true;
      
      await this.positionRepo.save(position);

      console.log(`   ✅ Position ${position.positionNumber}:`);
      console.log(`      Entry: ${position.entryPrice.toFixed(5)}`);
      console.log(`      Old SL: ${oldStopLoss.toFixed(5)}`);
      console.log(`      New SL: ${position.entryPrice.toFixed(5)} (BREAKEVEN)`);

      // TODO: Call MetaTrader API to modify position
      // await this.modifyPositionStopLoss(position.mtOrderTicket, position.entryPrice);
    }

    // Update trade record
    trade.breakevenActivated = true;
    trade.breakevenActivatedAt = new Date();
    await this.tradeRepo.save(trade);

    console.log(`\n✅ Breakeven activated for all ${openPositions.length} positions\n`);

    // Send notification
    await this.sendBreakevenNotification(trade, currentPrice);
  }

  /**
   * Get the furthest entry price (worst entry)
   * For BUY: highest entry price
   * For SELL: lowest entry price
   */
  private getFurthestEntry(trade: Trade, positions: Position[]): number {
    const entryPrices = positions.map(p => p.entryPrice);

    if (trade.direction === TradeDirection.BUY) {
      return Math.max(...entryPrices); // Highest entry for buys
    } else {
      return Math.min(...entryPrices); // Lowest entry for sells
    }
  }

  /**
   * Get pip size for symbol
   */
  private getPipSize(symbol: string): number {
    const pipSizes: { [key: string]: number } = {
      XAUUSD: 0.01,
      XAGUSD: 0.001,
      EURUSD: 0.0001,
      GBPUSD: 0.0001,
      USDJPY: 0.01,
      BTCUSD: 1,
      US30: 1,
      NAS100: 1,
      SPX500: 1,
    };

    return pipSizes[symbol.toUpperCase()] || 0.0001;
  }

  /**
   * Send breakeven activation notification
   */
  private async sendBreakevenNotification(
    trade: Trade,
    activationPrice: number
  ): Promise<void> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: trade.user_id },
      });

      if (!user) {
        console.log('⚠️  User not found for breakeven notification');
        return;
      }

      const settings = await this.settingsRepo.findOne({
        where: { user_id: user.id },
      });

      if (!settings || !settings.breakevenNotification) {
        console.log('ℹ️  Breakeven notifications disabled for user');
        return;
      }

      await this.emailService.sendBreakevenActivatedEmail(
        {
          userName: user.fullName,
          symbol: trade.symbol,
          direction: trade.direction,
          totalPositions: trade.totalPositions,
          currentProfit: trade.grossProfit,
          tradeId: trade.id,
          activationPrice,
        },
        user.id,
        user.email
      );

      console.log('📧 Breakeven notification sent');
    } catch (error) {
      console.error('⚠️  Failed to send breakeven notification:', error);
    }
  }

  /**
   * Calculate potential loss saved by breakeven
   * This is called when a breakeven SL is hit
   */
  calculateBreakevenSavings(
    originalStopLoss: number,
    entryPrice: number,
    lotSize: number,
    direction: TradeDirection
  ): number {
    const pipSize = 0.01; // Simplified
    const pipValue = 1; // $1 per pip per 0.01 lot

    // Calculate pips that would have been lost
    const pips = direction === TradeDirection.BUY
      ? (entryPrice - originalStopLoss) / pipSize
      : (originalStopLoss - entryPrice) / pipSize;

    const potentialLoss = pips * lotSize * pipValue;

    return Math.abs(potentialLoss);
  }

  /**
   * Check if a position should have its stop loss moved
   * Used for individual position management
   */
  async shouldMoveStopLoss(
    position: Position,
    currentPrice: number,
    threshold: number
  ): Promise<boolean> {
    if (position.breakevenActivated) {
      return false;
    }

    if (position.status !== PositionStatus.OPEN) {
      return false;
    }

    const pipSize = 0.01; // Get from symbol specs
    const pipsFromEntry = Math.abs(
      calculatePipDistance(currentPrice, position.entryPrice, pipSize)
    );

    return pipsFromEntry >= threshold;
  }

  /**
   * Get breakeven statistics for a user
   */
  async getBreakevenStats(userId: string, dateRange?: { start: Date; end: Date }) {
    const query = this.tradeRepo
      .createQueryBuilder('trade')
      .where('trade.user_id = :userId', { userId })
      .andWhere('trade.breakevenActivated = :activated', { activated: true });

    if (dateRange) {
      query.andWhere('trade.breakevenActivatedAt BETWEEN :start AND :end', dateRange);
    }

    const trades = await query.getMany();

    // Count how many trades had breakeven prevent a loss
    const savedTrades = trades.filter(t => 
      t.positions.some(p => p.closeReason === 'breakeven_sl')
    );

    return {
      totalBreakevenActivations: trades.length,
      tradesWithBreakevenSL: savedTrades.length,
      percentageSaved: trades.length > 0 
        ? (savedTrades.length / trades.length) * 100 
        : 0,
    };
  }

  /**
   * Emergency: Manually activate breakeven for a trade
   */
  async manuallyActivateBreakeven(tradeId: string, userId: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({
      where: { id: tradeId, user_id: userId },
      relations: ['positions'],
    });

    if (!trade) {
      throw new Error('Trade not found');
    }

    if (trade.breakevenActivated) {
      throw new Error('Breakeven already activated');
    }

    const openPositions = trade.positions.filter(
      p => p.status === PositionStatus.OPEN
    );

    if (openPositions.length === 0) {
      throw new Error('No open positions');
    }

    // Get current price (would normally come from MT)
    const currentPrice = 4200; // TODO: Get from MetaTrader

    await this.activateBreakeven(trade, openPositions, currentPrice);
  }
}