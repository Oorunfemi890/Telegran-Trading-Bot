// FILE: src/services/position.monitor.ts (EA-COMPATIBLE VERSION)
// =============================================
// PHASE 9: POSITION MONITORING - EA COMPATIBLE
// =============================================

import AppDataSource from "../config/database.config";
import { Trade } from "../database/entities/Trade.entity";
import { Position } from "../database/entities/Position.entity";
import { User } from "../database/entities/User.entity";
import { UserSettings } from "../database/entities/UserSettings.entity";
import { EmailService } from "./email.service";
import { getWebSocketServer } from "../websocket/socket.server";
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

    if (activeTrades.length > 0) {
      console.log(`\n🔍 Monitoring ${activeTrades.length} active trade(s)...`);

      for (const trade of activeTrades) {
        await this.monitorTrade(trade.id);
      }
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

      const currentPrice = await this.getCurrentPrice(trade.symbol);

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

      // Check stop loss
      await this.checkStopLoss(trade, currentPrice);

      // Check if trade is complete
      await this.checkTradeComplete(trade);
    } catch (error) {
      console.error(`❌ Error monitoring trade ${tradeId}:`, error);
    }
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
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
   * ✅ FIXED: Update stop loss in position record (EA will execute)
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

    const furthestEntry =
      trade.direction === TradeDirection.BUY
        ? Math.max(...openPositions.map((p) => p.entryPrice))
        : Math.min(...openPositions.map((p) => p.entryPrice));

    const pipSize = this.getPipSize(trade.symbol);
    const pipsFromEntry = Math.abs(
      calculatePipDistance(currentPrice, furthestEntry, pipSize)
    );

    if (pipsFromEntry >= settings.breakevenActivationPips) {
      console.log(`\n🛡️  BREAKEVEN ACTIVATED for trade ${trade.id}`);
      console.log(`   Price moved ${pipsFromEntry.toFixed(1)} pips`);
      console.log(`   Threshold: ${settings.breakevenActivationPips} pips\n`);

      // ✅ Update stop loss - EA will handle the actual modification
      for (const position of openPositions) {
        position.currentStopLoss = position.entryPrice;
        position.breakevenActivated = true;
        await this.positionRepo.save(position);

        console.log(
          `   ✅ Position ${position.positionNumber}: SL → ${position.entryPrice.toFixed(5)} (EA will modify)`
        );
      }

      trade.breakevenActivated = true;
      trade.breakevenActivatedAt = new Date();
      await this.tradeRepo.save(trade);

      await this.sendBreakevenNotification(trade, currentPrice);
    }
  }

  /**
   * ✅ FIXED: Mark positions for closure, don't close directly
   */
  private async checkTakeProfits(
    trade: Trade,
    currentPrice: number
  ): Promise<void> {
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );

    if (openPositions.length === 0) return;

    for (const tp of trade.takeProfits) {
      const tpReached =
        trade.direction === TradeDirection.BUY
          ? currentPrice >= tp.price
          : currentPrice <= tp.price;

      if (tpReached) {
        await this.markPositionsForTPClosure(
          trade,
          tp,
          currentPrice,
          openPositions
        );
      }
    }
  }

  /**
   * ✅ NEW: Mark positions for TP closure (EA will close them)
   */
  private async markPositionsForTPClosure(
    trade: Trade,
    tp: any,
    currentPrice: number,
    openPositions: Position[]
  ): Promise<void> {
    const positionsToClose = Math.min(tp.positions, openPositions.length);

    if (positionsToClose === 0) return;

    // Check if we've already marked these positions
    const alreadyMarked = trade.positions.filter(
      (p) =>
        p.closeReason === (`tp${tp.level}` as CloseReason) &&
        p.status === PositionStatus.OPEN
    ).length;

    if (alreadyMarked >= positionsToClose) return;

    console.log(`\n💰 TAKE PROFIT ${tp.level} HIT for trade ${trade.id}`);
    console.log(`   Target: ${tp.price.toFixed(5)}`);
    console.log(`   Current: ${currentPrice.toFixed(5)}`);
    console.log(`   Marking ${positionsToClose} position(s) for closure\n`);

    const sortedPositions = [...openPositions]
      .filter((p) => !p.closeReason) // Only unmarked positions
      .sort((a, b) =>
        trade.direction === TradeDirection.BUY
          ? a.entryPrice - b.entryPrice
          : b.entryPrice - a.entryPrice
      );

    for (
      let i = 0;
      i < Math.min(positionsToClose, sortedPositions.length);
      i++
    ) {
      const position = sortedPositions[i];

      // ✅ Mark for closure - EA will see this and close
      position.closedPrice = currentPrice;
      position.closeReason = `tp${tp.level}` as CloseReason;
      // Keep status as OPEN - EA will change to CLOSED after closing

      await this.positionRepo.save(position);

      console.log(
        `   ✅ Position ${position.positionNumber} marked for TP${tp.level} closure`
      );
    }

    // Notification will be sent when EA confirms closure
  }

  /**
   * ✅ FIXED: Mark for SL closure, don't close directly
   */
  private async checkStopLoss(
    trade: Trade,
    currentPrice: number
  ): Promise<void> {
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN && !p.closeReason // Not already marked
    );

    for (const position of openPositions) {
      const slHit =
        trade.direction === TradeDirection.BUY
          ? currentPrice <= position.currentStopLoss
          : currentPrice >= position.currentStopLoss;

      if (slHit) {
        await this.markPositionForSLClosure(trade, position, currentPrice);
      }
    }
  }

  /**
   * ✅ NEW: Mark position for SL closure
   */
  private async markPositionForSLClosure(
    trade: Trade,
    position: Position,
    currentPrice: number
  ): Promise<void> {
    const isBreakeven = position.breakevenActivated;

    console.log(`\n⚠️  STOP LOSS HIT for trade ${trade.id}`);
    console.log(`   Position: ${position.positionNumber}`);
    console.log(`   Type: ${isBreakeven ? "Breakeven" : "Original"}`);
    console.log(`   Marking for closure\n`);

    // ✅ Mark for closure
    position.closedPrice = currentPrice;
    position.closeReason = isBreakeven
      ? CloseReason.BREAKEVEN_SL
      : CloseReason.SL;
    // Keep status as OPEN - EA will change to CLOSED

    await this.positionRepo.save(position);

    console.log(
      `   ✅ Position ${position.positionNumber} marked for SL closure`
    );
  }

  /**
   * Check if trade is complete
   */
  private async checkTradeComplete(trade: Trade): Promise<void> {
    const openPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.OPEN
    );

    // Trade is complete when all positions are closed
    const closedPositions = trade.positions.filter(
      (p) => p.status === PositionStatus.CLOSED
    );

    if (
      openPositions.length === 0 &&
      closedPositions.length > 0 &&
      trade.status === TradeStatus.OPEN
    ) {
      console.log(`\n✅ TRADE COMPLETE: ${trade.id}\n`);

      trade.status = TradeStatus.CLOSED;
      trade.closedAt = new Date();
      await this.tradeRepo.save(trade);

      await this.sendTradeCompletedNotification(trade);
    }
  }

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

  private async sendBreakevenNotification(
    trade: Trade,
    activationPrice: number
  ): Promise<void> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: trade.user_id },
      });

      if (!user) return;

      const notificationData = {
        userName: user.fullName,
        symbol: trade.symbol,
        direction: trade.direction,
        totalPositions: trade.totalPositions,
        currentProfit: trade.grossProfit,
        tradeId: trade.id,
        activationPrice,
      };

      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.emitBreakevenActivated(user.id, {
          id: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          totalPositions: trade.totalPositions,
          currentProfit: trade.grossProfit,
          activationPrice,
        });
        console.log("📡 WebSocket: Breakeven activated event emitted");
      }

      await this.emailService.sendBreakevenActivatedEmail(
        notificationData,
        user.id,
        user.email
      );
      console.log("📧 Email: Breakeven notification sent");
    } catch (error) {
      console.error("⚠️  Failed to send breakeven notification:", error);
    }
  }

  private async sendTradeCompletedNotification(trade: Trade): Promise<void> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: trade.user_id },
      });

      if (!user) return;

      const duration =
        trade.closedAt && trade.openedAt
          ? this.formatDuration(
              trade.closedAt.getTime() - trade.openedAt.getTime()
            )
          : "N/A";

      const avgEntry =
        trade.positions.reduce((sum, p) => sum + p.entryPrice, 0) /
        trade.positions.length;

      const closedPositions = trade.positions.filter((p) => p.closedPrice);
      const avgExit =
        closedPositions.length > 0
          ? closedPositions.reduce((sum, p) => sum + (p.closedPrice || 0), 0) /
            closedPositions.length
          : 0;

      const notificationData = {
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
      };

      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.emitTradeCompleted(user.id, {
          id: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          totalPositions: trade.totalPositions,
          duration,
          netProfit: trade.netProfit,
          returnOnRisk: (trade.netProfit / trade.totalRiskAmount) * 100,
          status: trade.status,
          closedAt: trade.closedAt,
        });
        console.log("📡 WebSocket: Trade completed event emitted");
      }

      await this.emailService.sendTradeCompletedEmail(
        notificationData,
        user.id,
        user.email
      );
      console.log("📧 Email: Trade completed notification sent");
    } catch (error) {
      console.error("⚠️  Failed to send trade completed notification:", error);
    }
  }

  private formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }
}
