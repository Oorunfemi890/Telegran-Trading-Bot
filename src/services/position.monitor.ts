// FILE: src/services/position.monitor.ts
// =============================================
// PHASE 9: POSITION MONITORING SERVICE
// =============================================

import AppDataSource from "../config/database.config";
import { Trade } from "../database/entities/Trade.entity";
import { Position } from "../database/entities/Position.entity";
import { User } from "../database/entities/User.entity";
import { UserSettings } from "../database/entities/UserSettings.entity";
import { EmailService } from "./email.service";
import {
  TradeStatus,
  PositionStatus,
  CloseReason,
  TradeDirection,
} from "../types";
import { calculatePipDistance } from "../helpers/math.helper";

export class PositionMonitorService {
  private tradeRepo = AppDataSource.getRepository(Trade);
  private positionRepo = AppDataSource.getRepository(Position);
  private userRepo = AppDataSource.getRepository(User);
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Monitor all active trades
   */
  async monitorAllActiveTrades(): Promise<void> {
    const activeTrades = await this.tradeRepo.find({
      where: { status: TradeStatus.OPEN },
      relations: ["positions", "user"],
    });

    console.log(`\n🔍 Monitoring ${activeTrades.length} active trade(s)...`);

    for (const trade of activeTrades) {
      await this.monitorTrade(trade.id);
    }
  }

  /**
   * Monitor a single trade
   */
  async monitorTrade(tradeId: string): Promise<void> {
    try {
      const trade = await this.tradeRepo.findOne({
        where: { id: tradeId },
        relations: ["positions", "user"],
      });

      if (!trade || trade.status !== TradeStatus.OPEN) {
        return;
      }

      // Get current market price
      const currentPrice = await this.getCurrentPrice(trade.symbol);

      // Load settings
      const settings = await this.settingsRepo.findOne({
        where: { user_id: trade.user_id },
      });

      if (!settings) return;

      // Check breakeven
      if (!trade.breakevenActivated && settings.breakevenEnabled) {
        await this.checkBreakeven(trade, currentPrice, settings);
      }

      // Check take profits
      await this.checkTakeProfits(trade, currentPrice);

      // Check stop loss (automated by MT, but we track it)
      await this.checkStopLoss(trade, currentPrice);

      // Check if trade is complete
      await this.checkTradeComplete(trade);
    } catch (error) {
      console.error(`❌ Error monitoring trade ${tradeId}:`, error);
    }
  }

  /**
   * Get current market price (simulated)
   */
  private async getCurrentPrice(symbol: string): Promise<number> {
    // TODO: Integrate with MetaTrader API
    const prices: { [key: string]: number } = {
      XAUUSD: 4200 + Math.random() * 20,
      EURUSD: 1.085 + Math.random() * 0.002,
      GBPUSD: 1.27 + Math.random() * 0.002,
      USDJPY: 149.5 + Math.random() * 0.2,
      BTCUSD: 95000 + Math.random() * 200,
    };

    return prices[symbol] || 1.0;
  }

  /**
   * Check and activate breakeven
   */
  private async checkBreakeven(
    trade: Trade,
    currentPrice: number,
    settings: UserSettings
  ): Promise<void> {
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );

    if (openPositions.length === 0) return;

    // Get the furthest entry price
    const furthestEntry =
      trade.direction === TradeDirection.BUY
        ? Math.max(...openPositions.map((p) => p.entryPrice))
        : Math.min(...openPositions.map((p) => p.entryPrice));

    // Calculate pips from entry
    const pipSize = this.getPipSize(trade.symbol);
    const pipsFromEntry = Math.abs(
      calculatePipDistance(currentPrice, furthestEntry, pipSize)
    );

    // Check if breakeven should activate
    if (pipsFromEntry >= settings.breakevenActivationPips) {
      console.log(`\n🛡️  BREAKEVEN ACTIVATED for trade ${trade.id}`);
      console.log(`   Price moved ${pipsFromEntry.toFixed(1)} pips`);
      console.log(`   Threshold: ${settings.breakevenActivationPips} pips\n`);

      // Move all stop losses to entry prices
      for (const position of openPositions) {
        position.currentStopLoss = position.entryPrice;
        position.breakevenActivated = true;
        await this.positionRepo.save(position);

        console.log(
          `   ✅ Position ${position.positionNumber}: SL → ${position.entryPrice.toFixed(5)}`
        );
      }

      // Update trade
      trade.breakevenActivated = true;
      trade.breakevenActivatedAt = new Date();
      await this.tradeRepo.save(trade);

      // Send notification
      await this.sendBreakevenNotification(trade, currentPrice);
    }
  }

  /**
   * Check take profit levels
   */
  private async checkTakeProfits(
    trade: Trade,
    currentPrice: number
  ): Promise<void> {
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );

    if (openPositions.length === 0) return;

    // Check each TP level
    for (const tp of trade.takeProfits) {
      const tpReached =
        trade.direction === TradeDirection.BUY
          ? currentPrice >= tp.price
          : currentPrice <= tp.price;

      if (tpReached) {
        await this.executeTakeProfit(trade, tp, currentPrice, openPositions);
      }
    }
  }

  /**
   * Execute take profit closure
   */
  private async executeTakeProfit(
    trade: Trade,
    tp: any,
    currentPrice: number,
    openPositions: Position[]
  ): Promise<void> {
    const positionsToClose = Math.min(tp.positions, openPositions.length);

    if (positionsToClose === 0) return;

    console.log(`\n💰 TAKE PROFIT ${tp.level} HIT for trade ${trade.id}`);
    console.log(`   Target: ${tp.price.toFixed(5)}`);
    console.log(`   Current: ${currentPrice.toFixed(5)}`);
    console.log(`   Closing ${positionsToClose} position(s)\n`);

    // Sort by entry price (best first)
    const sortedPositions = [...openPositions].sort(
      (a, b) =>
        trade.direction === TradeDirection.BUY
          ? a.entryPrice - b.entryPrice // Lowest entry = most profit for BUY
          : b.entryPrice - a.entryPrice // Highest entry = most profit for SELL
    );

    let totalProfit = 0;

    // Close positions
    for (let i = 0; i < positionsToClose; i++) {
      const position = sortedPositions[i];

      const profit = this.calculateProfit(
        position.entryPrice,
        currentPrice,
        position.lotSize,
        trade.direction
      );

      position.status = PositionStatus.CLOSED;
      position.closedPrice = currentPrice;
      position.profit = profit;
      position.closeReason = `tp${tp.level}` as CloseReason;
      position.closedAt = new Date();

      await this.positionRepo.save(position);

      totalProfit += profit;

      console.log(
        `   ✅ Position ${position.positionNumber}: +$${profit.toFixed(2)}`
      );
    }

    // Update trade
    trade.grossProfit += totalProfit;
    trade.netProfit = trade.grossProfit - trade.commissions;
    await this.tradeRepo.save(trade);

    // Send notification
    await this.sendTakeProfitNotification(
      trade,
      tp.level,
      tp.price,
      positionsToClose,
      openPositions.length - positionsToClose,
      totalProfit
    );
  }

  /**
   * Check stop loss
   */
  private async checkStopLoss(
    trade: Trade,
    currentPrice: number
  ): Promise<void> {
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );

    for (const position of openPositions) {
      const slHit =
        trade.direction === TradeDirection.BUY
          ? currentPrice <= position.currentStopLoss
          : currentPrice >= position.currentStopLoss;

      if (slHit) {
        await this.executeStopLoss(trade, position, currentPrice);
      }
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
    const loss = this.calculateProfit(
      position.entryPrice,
      position.currentStopLoss,
      position.lotSize,
      trade.direction
    );

    const isBreakeven = position.breakevenActivated;

    console.log(`\n⚠️  STOP LOSS HIT for trade ${trade.id}`);
    console.log(`   Position: ${position.positionNumber}`);
    console.log(`   Type: ${isBreakeven ? "Breakeven" : "Original"}`);
    console.log(`   Loss: $${loss.toFixed(2)}\n`);

    position.status = PositionStatus.CLOSED;
    position.closedPrice = currentPrice;
    position.profit = loss;
    position.closeReason = isBreakeven
      ? CloseReason.BREAKEVEN_SL
      : CloseReason.SL;
    position.closedAt = new Date();

    await this.positionRepo.save(position);

    // Update trade
    trade.grossProfit += loss;
    trade.netProfit = trade.grossProfit - trade.commissions;
    await this.tradeRepo.save(trade);

    // Send notification only if all positions closed
    const remainingOpen = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    ).length;

    if (remainingOpen === 0) {
      await this.sendStopLossNotification(trade, isBreakeven, Math.abs(loss));
    }
  }

  /**
   * Check if trade is complete
   */
  private async checkTradeComplete(trade: Trade): Promise<void> {
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );

    if (openPositions.length === 0 && trade.status === TradeStatus.OPEN) {
      console.log(`\n✅ TRADE COMPLETE: ${trade.id}\n`);

      trade.status = TradeStatus.CLOSED;
      trade.closedAt = new Date();
      await this.tradeRepo.save(trade);

      await this.sendTradeCompletedNotification(trade);
    }
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
    const pipSize = 0.01; // Simplified
    const pipValue = 1; // $1 per pip per 0.01 lot

    const pips =
      direction === TradeDirection.BUY
        ? (exitPrice - entryPrice) / pipSize
        : (entryPrice - exitPrice) / pipSize;

    return pips * lotSize * pipValue;
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
    };

    return pipSizes[symbol] || 0.0001;
  }

  /**
   * Send breakeven notification
   */
  private async sendBreakevenNotification(
    trade: Trade,
    activationPrice: number
  ): Promise<void> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: trade.user_id },
      });

      if (!user) return;

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
    } catch (error) {
      console.error("⚠️  Failed to send breakeven email:", error);
    }
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

      if (!user) return;

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
    } catch (error) {
      console.error("⚠️  Failed to send TP email:", error);
    }
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

      if (!user) return;

      const positionsClosed = trade.positions.filter(
        (p) => p.status === PositionStatus.CLOSED
      ).length;

      await this.emailService.sendStopLossHitEmail(
        {
          userName: user.fullName,
          symbol: trade.symbol,
          direction: trade.direction,
          stopLossType: isBreakeven ? "breakeven" : "original",
          lossAmount,
          positionsClosed,
          tradeId: trade.id,
          accountBalance: 10000, // TODO: Get from account
          riskPercentage: 10, // TODO: Get from settings
        },
        user.id,
        user.email
      );
    } catch (error) {
      console.error("⚠️  Failed to send SL email:", error);
    }
  }

  /**
   * Send trade completed notification
   */
  private async sendTradeCompletedNotification(trade: Trade): Promise<void> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: trade.user_id },
      });

      if (!user) return;

      // Calculate duration
      const duration =
        trade.closedAt && trade.openedAt
          ? this.formatDuration(
              trade.closedAt.getTime() - trade.openedAt.getTime()
            )
          : "N/A";

      // Calculate averages
      const avgEntry =
        trade.positions.reduce((sum, p) => sum + p.entryPrice, 0) /
        trade.positions.length;

      const avgExit =
        trade.positions
          .filter((p) => p.closedPrice)
          .reduce((sum, p) => sum + (p.closedPrice || 0), 0) /
        trade.positions.filter((p) => p.closedPrice).length;

      await this.emailService.sendTradeCompletedEmail(
        {
          userName: user.fullName,
          symbol: trade.symbol,
          direction: trade.direction,
          totalPositions: trade.totalPositions,
          duration,
          netProfit: trade.netProfit,
          returnOnRisk: (trade.netProfit / trade.totalRiskAmount) * 100,
          averageEntry: avgEntry,
          averageExit: avgExit,
          tradeId: trade.id,
          positionBreakdown: trade.positions.map((p) => ({
            position: p.positionNumber,
            entryPrice: p.entryPrice,
            exitPrice: p.closedPrice || 0,
            profit: p.profit,
            closeReason: p.closeReason || "unknown",
          })),
        },
        user.id,
        user.email
      );
    } catch (error) {
      console.error("⚠️  Failed to send trade completed email:", error);
    }
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }
}
