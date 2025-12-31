// FILE: src/handlers/signal.handler.ts (UPDATED WITH WEBSOCKET)
// =============================================
// PHASE 6: SIGNAL HANDLER + PHASE 12: WEBSOCKET
// =============================================

import AppDataSource from "../config/database.config";
import { Signal } from "../database/entities/Signal.entity";
import { UserChannelSubscription } from "../database/entities/UserChannelSubscription.entity";
import { UserSettings } from "../database/entities/UserSettings.entity";
import { Trade } from "../database/entities/Trade.entity";
import { SignalStatus, TradeStatus, TradeDirection } from "../types";
import { isWithinTradingHours } from "../helpers/date.helper";
import { Queue } from "bullmq";
import { getRedisClient } from "../config/redis.config";
import { getWebSocketServer } from "../websocket/socket.server"; // ✅ ADDED

export interface UserMatchResult {
  userId: string;
  userEmail: string;
  userName: string;
  settings: UserSettings;
  accountBalance: number;
}

export class SignalHandler {
  private signalRepo = AppDataSource.getRepository(Signal);
  private subscriptionRepo = AppDataSource.getRepository(
    UserChannelSubscription
  );
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private tradeRepo = AppDataSource.getRepository(Trade);
  private executionQueue: Queue | null = null;

  constructor() {
    this.initializeQueue();
  }

  private initializeQueue() {
    const redis = getRedisClient();
    if (redis && redis.status === "ready") {
      this.executionQueue = new Queue("trade-execution", {
        connection: redis,
      });
      console.log("✅ Trade execution queue initialized");
    }
  }

  /**
   * Process a newly created signal
   */
  async processNewSignal(signalId: string): Promise<void> {
    try {
      console.log(`\n🔄 Processing signal: ${signalId}`);

      const signal = await this.signalRepo.findOne({
        where: { id: signalId },
        relations: ["channel"],
      });

      if (!signal) {
        console.error("❌ Signal not found:", signalId);
        return;
      }

      if (signal.status !== SignalStatus.ACTIVE) {
        console.log("⚠️  Signal is not active, skipping");
        return;
      }

      if (signal.expiresAt < new Date()) {
        console.log("⏰ Signal expired, marking as expired");
        signal.status = SignalStatus.EXPIRED;
        await this.signalRepo.save(signal);
        return;
      }

      console.log(`📊 Signal Details:`);
      console.log(`   Symbol: ${signal.symbol}`);
      console.log(`   Direction: ${signal.direction}`);
      console.log(`   Entry: ${signal.entryMin} - ${signal.entryMax}`);
      console.log(`   SL: ${signal.stopLoss}`);
      console.log(`   TPs: ${signal.takeProfits.length} levels`);

      const eligibleUsers = await this.findEligibleUsers(signal);

      console.log(`👥 Found ${eligibleUsers.length} eligible users`);

      if (eligibleUsers.length === 0) {
        console.log("⚠️  No eligible users for this signal");
        return;
      }

      // ✅ EMIT WEBSOCKET EVENT TO ALL ELIGIBLE USERS
      const wsServer = getWebSocketServer();
      if (wsServer) {
        for (const user of eligibleUsers) {
          wsServer.emitSignalDetected(user.userId, {
            id: signal.id,
            symbol: signal.symbol,
            direction: signal.direction,
            entryMin: signal.entryMin,
            entryMax: signal.entryMax,
            stopLoss: signal.stopLoss,
            takeProfits: signal.takeProfits,
            channel: signal.channel.title,
            signalTime: signal.signalTime,
          });
        }
        console.log(
          `📡 WebSocket: Signal detected events sent to ${eligibleUsers.length} users`
        );
      }

      // Queue trade execution for each eligible user
      for (const user of eligibleUsers) {
        await this.queueTradeExecution(signal, user);
      }

      console.log(`✅ Queued ${eligibleUsers.length} trade executions\n`);
    } catch (error) {
      console.error("❌ Error processing signal:", error);
    }
  }

  /**
   * Find all users eligible to trade this signal
   */
  private async findEligibleUsers(signal: Signal): Promise<UserMatchResult[]> {
    const eligibleUsers: UserMatchResult[] = [];

    const subscriptions = await this.subscriptionRepo.find({
      where: {
        channel_id: signal.channel_id,
        isActive: true,
      },
      relations: ["user"],
    });

    console.log(`📋 Checking ${subscriptions.length} subscribed users...`);

    for (const subscription of subscriptions) {
      const user = subscription.user;

      const settings = await this.settingsRepo.findOne({
        where: { user_id: user.id },
      });

      if (!settings) {
        console.log(`   ⚠️  User ${user.email}: No settings found`);
        continue;
      }

      if (!user.canCreateTrades()) {
        console.log(
          `   ❌ User ${user.email}: Account not active or subscription expired`
        );
        continue;
      }

      if (!settings.tradingEnabled) {
        console.log(`   ⏸️  User ${user.email}: Trading disabled`);
        continue;
      }

      if (!this.isSymbolAllowed(signal.symbol, settings.allowedSymbols)) {
        console.log(
          `   🚫 User ${user.email}: Symbol ${signal.symbol} not allowed`
        );
        continue;
      }

      if (!this.isWithinTradingHours(settings)) {
        console.log(`   🕐 User ${user.email}: Outside trading hours`);
        continue;
      }

      const hasCapacity = await this.hasTradeCapacity(
        user.id,
        settings.maxConcurrentTrades
      );
      if (!hasCapacity) {
        console.log(`   📊 User ${user.email}: Max concurrent trades reached`);
        continue;
      }

      console.log(`   ✅ User ${user.email}: Eligible`);

      eligibleUsers.push({
        userId: user.id,
        userEmail: user.email,
        userName: user.fullName,
        settings,
        accountBalance: 10000,
      });
    }

    return eligibleUsers;
  }

  private isSymbolAllowed(symbol: string, allowedSymbols: string[]): boolean {
    if (allowedSymbols.length === 0) return true;
    return allowedSymbols.includes(symbol.toUpperCase());
  }

  private isWithinTradingHours(settings: UserSettings): boolean {
    if (!settings.tradingHoursStart || !settings.tradingHoursEnd) {
      return true;
    }

    return isWithinTradingHours(
      new Date(),
      settings.tradingHoursStart,
      settings.tradingHoursEnd
    );
  }

  private async hasTradeCapacity(
    userId: string,
    maxConcurrent: number
  ): Promise<boolean> {
    const openTrades = await this.tradeRepo.count({
      where: {
        user_id: userId,
        status: TradeStatus.OPEN,
      },
    });

    return openTrades < maxConcurrent;
  }

  private async queueTradeExecution(
    signal: Signal,
    user: UserMatchResult
  ): Promise<void> {
    try {
      if (!this.executionQueue) {
        console.log("⚠️  Execution queue not available - skipping queue");
        return;
      }

      await this.executionQueue.add(
        "execute-trade",
        {
          signalId: signal.id,
          userId: user.userId,
          userEmail: user.userEmail,
          userName: user.userName,
          symbol: signal.symbol,
          direction: signal.direction,
        },
        {
          priority: 1,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        }
      );

      console.log(`   📤 Queued execution for ${user.userEmail}`);
    } catch (error) {
      console.error(
        `   ❌ Failed to queue execution for ${user.userEmail}:`,
        error
      );
    }
  }

  async markSignalCompleted(signalId: string): Promise<void> {
    try {
      const signal = await this.signalRepo.findOne({
        where: { id: signalId },
      });

      if (signal && signal.status === SignalStatus.ACTIVE) {
        signal.status = SignalStatus.COMPLETED;
        await this.signalRepo.save(signal);
        console.log(`✅ Signal ${signalId} marked as completed`);
      }
    } catch (error) {
      console.error("❌ Error marking signal as completed:", error);
    }
  }

  async checkForDuplicate(
    channelId: string,
    symbol: string,
    direction: TradeDirection,
    entryPrice: number,
    timeWindowMinutes: number = 30
  ): Promise<Signal | null> {
    const windowStart = new Date();
    windowStart.setMinutes(windowStart.getMinutes() - timeWindowMinutes);

    const duplicates = await this.signalRepo.find({
      where: {
        channel_id: channelId,
        symbol,
        direction,
        status: SignalStatus.ACTIVE,
      },
    });

    for (const signal of duplicates) {
      if (signal.signalTime < windowStart) continue;

      const priceDiff = Math.abs(signal.entryMax - entryPrice) / entryPrice;
      if (priceDiff < 0.001) {
        console.log("🔍 Duplicate signal detected, skipping");
        return signal;
      }
    }

    return null;
  }
}
