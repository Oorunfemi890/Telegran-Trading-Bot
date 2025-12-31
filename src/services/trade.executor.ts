// FILE: src/services/trade.executor.ts (UPDATED WITH WEBSOCKET)
// =============================================
// PHASE 8: TRADE EXECUTION SERVICE + PHASE 12: WEBSOCKET
// =============================================

import AppDataSource from "../config/database.config";
import { Trade } from "../database/entities/Trade.entity";
import { Position } from "../database/entities/Position.entity";
import { Signal } from "../database/entities/Signal.entity";
import { User } from "../database/entities/User.entity";
import { UserSettings } from "../database/entities/UserSettings.entity";
import { TradingAccount } from "../database/entities/TradingAccount.entity";
import { RiskCalculator } from "./risk.calculator";
import { RiskValidationService } from "./risk.validation";
import { EmailService } from "./email.service";
import { getWebSocketServer } from "../websocket/socket.server"; // ✅ ADDED
import {
  TradeDirection,
  TradeStatus,
  PositionStatus,
  OrderType,
} from "../types";
import { distributePositionsAcrossRange } from "../helpers/math.helper";

export interface TradeExecutionResult {
  success: boolean;
  tradeId?: string;
  error?: string;
  details?: {
    positionsOpened: number;
    totalRisk: number;
    lotSize: number;
  };
}

export class TradeExecutorService {
  private tradeRepo = AppDataSource.getRepository(Trade);
  private positionRepo = AppDataSource.getRepository(Position);
  private signalRepo = AppDataSource.getRepository(Signal);
  private userRepo = AppDataSource.getRepository(User);
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private accountRepo = AppDataSource.getRepository(TradingAccount);

  private riskCalculator: RiskCalculator;
  private riskValidator: RiskValidationService;
  private emailService: EmailService;

  constructor() {
    this.riskCalculator = new RiskCalculator();
    this.riskValidator = new RiskValidationService();
    this.emailService = new EmailService();
  }

  /**
   * Main execution function - Execute a trade for a user
   */
  async executeTrade(
    userId: string,
    signalId: string
  ): Promise<TradeExecutionResult> {
    console.log(`\n🚀 EXECUTING TRADE`);
    console.log(`   User: ${userId}`);
    console.log(`   Signal: ${signalId}\n`);

    try {
      // 1. Load all required data
      const { user, signal, settings, account } = await this.loadTradeData(
        userId,
        signalId
      );

      // 2. Validate market price is still within entry range
      const currentPrice = await this.getCurrentMarketPrice(signal.symbol);
      if (!this.isPriceValid(signal, currentPrice)) {
        console.log("❌ Price moved outside entry range - signal expired");
        return {
          success: false,
          error: "Market price outside entry range",
        };
      }

      console.log(`✅ Current price valid: ${currentPrice.toFixed(5)}`);

      // 3. Calculate lot sizes and risk
      const riskCalc = this.riskCalculator.calculateLotSize({
        accountBalance: account.balance,
        riskPercentage: settings.balanceUsagePercentage,
        positionsPerTrade: settings.positionsPerTrade,
        entryPrice: (signal.entryMin + signal.entryMax) / 2,
        stopLoss: signal.stopLoss,
        symbol: signal.symbol,
      });

      if (!riskCalc.success) {
        console.log("❌ Lot size calculation failed:", riskCalc.error);
        return {
          success: false,
          error: riskCalc.error,
        };
      }

      console.log(
        `💰 Lot size calculated: ${riskCalc.lotSizePerPosition.toFixed(2)}`
      );

      // 4. Validate all risk parameters
      const requiredMargin = this.riskCalculator.calculateMarginRequired(
        signal.symbol,
        riskCalc.lotSizePerPosition,
        settings.positionsPerTrade
      );

      const riskValidation = await this.riskValidator.validateTrade(
        userId,
        settings,
        account.balance,
        account.freeMargin,
        riskCalc.lotSizePerPosition,
        riskCalc.totalRiskAmount,
        requiredMargin
      );

      if (!riskValidation.valid) {
        console.log("❌ Risk validation failed:", riskValidation.reason);
        return {
          success: false,
          error: riskValidation.reason,
        };
      }

      console.log("✅ Risk validation passed\n");

      // 5. Generate entry prices for each position
      const entryPrices = this.generateEntryPrices(
        signal.direction,
        signal.entryMin,
        signal.entryMax,
        settings.positionsPerTrade
      );

      console.log("📍 Entry prices generated:");
      entryPrices.forEach((price, i) => {
        console.log(`   Position ${i + 1}: ${price.toFixed(5)}`);
      });
      console.log("");

      // 6. Create master trade record
      const trade = await this.createTradeRecord(
        user,
        signal,
        account,
        settings,
        riskCalc,
        entryPrices
      );

      console.log(`✅ Trade record created: ${trade.id}\n`);

      // 7. Place orders for each position
      const positionsOpened = await this.placeOrders(
        trade,
        signal,
        entryPrices,
        riskCalc.lotSizePerPosition,
        settings
      );

      console.log(`✅ ${positionsOpened} positions opened\n`);

      // 8. Send notifications (EMAIL + WEBSOCKET)
      await this.sendTradeOpenedNotification(user, trade, signal, entryPrices);

      return {
        success: true,
        tradeId: trade.id,
        details: {
          positionsOpened,
          totalRisk: riskCalc.totalRiskAmount,
          lotSize: riskCalc.lotSizePerPosition,
        },
      };
    } catch (error: any) {
      console.error("❌ Trade execution failed:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Load all required data for trade execution
   */
  private async loadTradeData(userId: string, signalId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const signal = await this.signalRepo.findOne({
      where: { id: signalId },
      relations: ["channel"],
    });

    if (!signal) {
      throw new Error("Signal not found");
    }

    const settings = await this.settingsRepo.findOne({
      where: { user_id: userId },
    });

    if (!settings) {
      throw new Error("User settings not found");
    }

    const account = await this.accountRepo.findOne({
      where: { user_id: userId, isPrimary: true, isActive: true },
    });

    if (!account) {
      throw new Error("No active trading account found");
    }

    return { user, signal, settings, account };
  }

  /**
   * Get current market price (simulated for now)
   */
  private async getCurrentMarketPrice(symbol: string): Promise<number> {
    const prices: { [key: string]: number } = {
      XAUUSD: 4200 + Math.random() * 10,
      EURUSD: 1.085 + Math.random() * 0.001,
      GBPUSD: 1.27 + Math.random() * 0.001,
      USDJPY: 149.5 + Math.random() * 0.1,
      BTCUSD: 95000 + Math.random() * 100,
    };

    return prices[symbol] || 1.0;
  }

  /**
   * Validate price is within entry range
   */
  private isPriceValid(signal: Signal, currentPrice: number): boolean {
    const buffer = 0.001;

    if (signal.direction === TradeDirection.BUY) {
      return currentPrice <= signal.entryMax * (1 + buffer);
    } else {
      return currentPrice >= signal.entryMin * (1 - buffer);
    }
  }

  /**
   * Generate entry prices for positions
   */
  private generateEntryPrices(
    direction: TradeDirection,
    entryMin: number,
    entryMax: number,
    totalPositions: number
  ): number[] {
    if (direction === TradeDirection.BUY) {
      return distributePositionsAcrossRange(
        entryMin,
        entryMax,
        totalPositions,
        2
      );
    } else {
      const prices = distributePositionsAcrossRange(
        entryMin,
        entryMax,
        totalPositions,
        2
      );
      return prices.reverse();
    }
  }

  /**
   * Create master trade record
   */
  private async createTradeRecord(
    user: User,
    signal: Signal,
    account: TradingAccount,
    settings: UserSettings,
    riskCalc: any,
    entryPrices: number[]
  ): Promise<Trade> {
    const trade = this.tradeRepo.create({
      user_id: user.id,
      signal_id: signal.id,
      trading_account_id: account.id,
      symbol: signal.symbol,
      direction: signal.direction,
      totalPositions: settings.positionsPerTrade,
      positionsFilled: 0,
      entryPrices: entryPrices.map((price, i) => ({
        position: i + 1,
        price,
      })),
      stopLoss: signal.stopLoss,
      takeProfits: signal.takeProfits.map((tp, i) => ({
        level: tp.level,
        price: tp.price,
        positions: this.getPositionsForTP(i, settings.positionsPerTrade),
      })),
      lotSizePerPosition: riskCalc.lotSizePerPosition,
      totalRiskAmount: riskCalc.totalRiskAmount,
      status: TradeStatus.PENDING,
      breakevenActivated: false,
      grossProfit: 0,
      commissions: 0,
      netProfit: 0,
    });

    return await this.tradeRepo.save(trade);
  }

  /**
   * Get number of positions to close at each TP level
   */
  private getPositionsForTP(tpIndex: number, totalPositions: number): number {
    if (tpIndex === 0) {
      return Math.ceil(totalPositions * 0.4);
    } else if (tpIndex === 1) {
      return Math.ceil(totalPositions * 0.4);
    } else {
      return Math.floor(totalPositions * 0.2);
    }
  }

  /**
   * Place orders for all positions
   */
  private async placeOrders(
    trade: Trade,
    signal: Signal,
    entryPrices: number[],
    lotSize: number,
    settings: UserSettings
  ): Promise<number> {
    let positionsOpened = 0;

    for (let i = 0; i < entryPrices.length; i++) {
      const entryPrice = entryPrices[i];
      const isImmediateEntry = i < 2;

      try {
        const position = this.positionRepo.create({
          trade_id: trade.id,
          positionNumber: i + 1,
          entryPrice,
          lotSize,
          currentStopLoss: signal.stopLoss,
          currentTakeProfit: signal.takeProfits[0].price,
          mtOrderTicket: this.generateTicketNumber(),
          orderType: isImmediateEntry ? OrderType.MARKET : OrderType.LIMIT,
          breakevenActivated: false,
          status: isImmediateEntry
            ? PositionStatus.OPEN
            : PositionStatus.PENDING,
          profit: 0,
          openedAt: isImmediateEntry ? new Date() : null,
        });

        await this.positionRepo.save(position);

        if (isImmediateEntry) {
          positionsOpened++;
          trade.positionsFilled++;
        }

        console.log(
          `   ✅ Position ${i + 1} placed: ${isImmediateEntry ? "MARKET" : "LIMIT"} @ ${entryPrice.toFixed(5)}`
        );
      } catch (error) {
        console.error(`   ❌ Failed to place position ${i + 1}:`, error);
      }
    }

    trade.status = TradeStatus.OPEN;
    trade.openedAt = new Date();
    await this.tradeRepo.save(trade);

    return positionsOpened;
  }

  /**
   * Generate simulated MT order ticket
   */
  private generateTicketNumber(): string {
    return Math.floor(Math.random() * 1000000000).toString();
  }

  /**
   * ✅ Send trade opened notification (EMAIL + WEBSOCKET)
   */
  private async sendTradeOpenedNotification(
    user: User,
    trade: Trade,
    signal: Signal,
    entryPrices: number[]
  ): Promise<void> {
    try {
      const tradeData = {
        userName: user.fullName,
        symbol: trade.symbol,
        direction: trade.direction,
        totalPositions: trade.totalPositions,
        lotSize: trade.lotSizePerPosition,
        stopLoss: trade.stopLoss,
        takeProfits: trade.takeProfits,
        riskAmount: trade.totalRiskAmount,
        entryPrices: entryPrices.map((price, i) => ({
          position: i + 1,
          price,
        })),
        averageEntry:
          entryPrices.reduce((a, b) => a + b, 0) / entryPrices.length,
        tradeId: trade.id,
      };

      // ✅ EMIT WEBSOCKET EVENT (REAL-TIME)
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.emitTradeOpened(user.id, {
          id: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          totalPositions: trade.totalPositions,
          positionsFilled: trade.positionsFilled,
          lotSize: trade.lotSizePerPosition,
          riskAmount: trade.totalRiskAmount,
          entryPrices,
          stopLoss: trade.stopLoss,
          takeProfits: trade.takeProfits,
          status: trade.status,
          openedAt: trade.openedAt,
        });
        console.log("📡 WebSocket: Trade opened event emitted");
      }

      // Send email notification
      await this.emailService.sendTradeOpenedEmail(
        tradeData,
        user.id,
        user.email
      );

      console.log("📧 Email: Trade opened notification sent");
    } catch (error) {
      console.error("⚠️  Failed to send trade opened notification:", error);
    }
  }
}
