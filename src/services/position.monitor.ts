// FILE: src/services/position.monitor.ts (UPDATED WITH WEBSOCKET)
// =============================================
// PHASE 9: POSITION MONITORING + PHASE 12: WEBSOCKET
// =============================================

import AppDataSource from "../config/database.config";
import { Trade } from "../database/entities/Trade.entity";
import { Position } from "../database/entities/Position.entity";
import { User } from "../database/entities/User.entity";
import { UserSettings } from "../database/entities/UserSettings.entity";
import { EmailService } from "./email.service";
import { getWebSocketServer } from "../websocket/socket.server"; // ✅ ADDED
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

      for (const position of openPositions) {
        position.currentStopLoss = position.entryPrice;
        position.breakevenActivated = true;
        await this.positionRepo.save(position);

        console.log(
          `   ✅ Position ${position.positionNumber}: SL → ${position.entryPrice.toFixed(5)}`
        );
      }

      trade.breakevenActivated = true;
      trade.breakevenActivatedAt = new Date();
      await this.tradeRepo.save(trade);

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

    const sortedPositions = [...openPositions].sort((a, b) =>
      trade.direction === TradeDirection.BUY
        ? a.entryPrice - b.entryPrice
        : b.entryPrice - a.entryPrice
    );

    let totalProfit = 0;

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

    trade.grossProfit += totalProfit;
    trade.netProfit = trade.grossProfit - trade.commissions;
    await this.tradeRepo.save(trade);

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

    trade.grossProfit += loss;
    trade.netProfit = trade.grossProfit - trade.commissions;
    await this.tradeRepo.save(trade);

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

  private calculateProfit(
    entryPrice: number,
    exitPrice: number,
    lotSize: number,
    direction: TradeDirection
  ): number {
    const pipSize = 0.01;
    const pipValue = 1;

    const pips =
      direction === TradeDirection.BUY
        ? (exitPrice - entryPrice) / pipSize
        : (entryPrice - exitPrice) / pipSize;

    return pips * lotSize * pipValue;
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

  /**
   * ✅ Send breakeven notification (EMAIL + WEBSOCKET)
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

      const notificationData = {
        userName: user.fullName,
        symbol: trade.symbol,
        direction: trade.direction,
        totalPositions: trade.totalPositions,
        currentProfit: trade.grossProfit,
        tradeId: trade.id,
        activationPrice,
      };

      // ✅ EMIT WEBSOCKET EVENT
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

      // Send email
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

  /**
   * ✅ Send take profit notification (EMAIL + WEBSOCKET)
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

      const notificationData = {
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
      };

      // ✅ EMIT WEBSOCKET EVENT
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.emitTakeProfitHit(
          user.id,
          {
            id: trade.id,
            symbol: trade.symbol,
            direction: trade.direction,
            tpLevel,
            tpPrice,
            positionsClosed,
            positionsRemaining,
            profitFromTP,
            totalProfit: trade.grossProfit,
          },
          tpLevel
        );
        console.log(`📡 WebSocket: TP${tpLevel} hit event emitted`);
      }

      // Send email
      await this.emailService.sendTakeProfitHitEmail(
        notificationData,
        user.id,
        user.email
      );
      console.log(`📧 Email: TP${tpLevel} notification sent`);
    } catch (error) {
      console.error("⚠️  Failed to send TP notification:", error);
    }
  }

  /**
   * ✅ Send stop loss notification (EMAIL + WEBSOCKET)
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

      const notificationData = {
        userName: user.fullName,
        symbol: trade.symbol,
        direction: trade.direction,
        stopLossType: isBreakeven
          ? ("breakeven" as const)
          : ("original" as const),
        lossAmount,
        positionsClosed,
        tradeId: trade.id,
        accountBalance: 10000,
        riskPercentage: 10,
      };

      // ✅ EMIT WEBSOCKET EVENT
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.emitStopLossHit(user.id, {
          id: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          stopLossType: isBreakeven ? "breakeven" : "original",
          lossAmount,
        });
        console.log("📡 WebSocket: Stop loss hit event emitted");
      }

      // Send email
      await this.emailService.sendStopLossHitEmail(
        notificationData,
        user.id,
        user.email
      );
      console.log("📧 Email: Stop loss notification sent");
    } catch (error) {
      console.error("⚠️  Failed to send SL notification:", error);
    }
  }

  /**
   * ✅ Send trade completed notification (EMAIL + WEBSOCKET)
   */
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

      const avgExit =
        trade.positions
          .filter((p) => p.closedPrice)
          .reduce((sum, p) => sum + (p.closedPrice || 0), 0) /
        trade.positions.filter((p) => p.closedPrice).length;

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

      // ✅ EMIT WEBSOCKET EVENT
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

      // Send email
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
