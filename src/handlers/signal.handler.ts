// FILE: src/handlers/signal.handler.ts
// =============================================
import AppDataSource from '../config/database.config';
import { Signal } from '../database/entities/Signal.entity';
import { UserChannelSubscription } from '../database/entities/UserChannelSubscription.entity';
import { UserSettings } from '../database/entities/UserSettings.entity';
import { Trade } from '../database/entities/Trade.entity';
import { SignalStatus, TradeStatus, TradeDirection } from '../types';
import { isWithinTradingHours } from '../helpers/date.helper';
import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis.config';

export interface UserMatchResult {
  userId: string;
  userEmail: string;
  userName: string;
  settings: UserSettings;
  accountBalance: number;
}

export class SignalHandler {
  private signalRepo = AppDataSource.getRepository(Signal);
  private subscriptionRepo = AppDataSource.getRepository(UserChannelSubscription);
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private tradeRepo = AppDataSource.getRepository(Trade);
  private executionQueue: Queue | null = null;

  constructor() {
    this.initializeQueue();
  }

  /**
   * Initialize execution queue
   */
  private initializeQueue() {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      this.executionQueue = new Queue('trade-execution', {
        connection: redis,
      });
      console.log('✅ Trade execution queue initialized');
    }
  }

  /**
   * Process a newly created signal
   * This is the main entry point after a signal is parsed and saved
   */
  async processNewSignal(signalId: string): Promise<void> {
    try {
      console.log(`\n🔄 Processing signal: ${signalId}`);

      // Load the signal
      const signal = await this.signalRepo.findOne({
        where: { id: signalId },
        relations: ['channel'],
      });

      if (!signal) {
        console.error('❌ Signal not found:', signalId);
        return;
      }

      // Check if signal is still active
      if (signal.status !== SignalStatus.ACTIVE) {
        console.log('⚠️  Signal is not active, skipping');
        return;
      }

      // Check if signal has expired
      if (signal.expiresAt < new Date()) {
        console.log('⏰ Signal expired, marking as expired');
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

      // Find all eligible users
      const eligibleUsers = await this.findEligibleUsers(signal);

      console.log(`👥 Found ${eligibleUsers.length} eligible users`);

      if (eligibleUsers.length === 0) {
        console.log('⚠️  No eligible users for this signal');
        return;
      }

      // Queue trade execution for each eligible user
      for (const user of eligibleUsers) {
        await this.queueTradeExecution(signal, user);
      }

      console.log(`✅ Queued ${eligibleUsers.length} trade executions\n`);
    } catch (error) {
      console.error('❌ Error processing signal:', error);
    }
  }

  /**
   * Find all users eligible to trade this signal
   */
  private async findEligibleUsers(signal: Signal): Promise<UserMatchResult[]> {
    const eligibleUsers: UserMatchResult[] = [];

    // Find all users subscribed to this channel
    const subscriptions = await this.subscriptionRepo.find({
      where: {
        channel_id: signal.channel_id,
        isActive: true,
      },
      relations: ['user'],
    });

    console.log(`📋 Checking ${subscriptions.length} subscribed users...`);

    for (const subscription of subscriptions) {
      const user = subscription.user;

      // Load user settings
      const settings = await this.settingsRepo.findOne({
        where: { user_id: user.id },
      });

      if (!settings) {
        console.log(`   ⚠️  User ${user.email}: No settings found`);
        continue;
      }

      // Check if user can create trades
      if (!user.canCreateTrades()) {
        console.log(`   ❌ User ${user.email}: Account not active or subscription expired`);
        continue;
      }

      // Check if trading is enabled
      if (!settings.tradingEnabled) {
        console.log(`   ⏸️  User ${user.email}: Trading disabled`);
        continue;
      }

      // Check if symbol is allowed
      if (!this.isSymbolAllowed(signal.symbol, settings.allowedSymbols)) {
        console.log(`   🚫 User ${user.email}: Symbol ${signal.symbol} not allowed`);
        continue;
      }

      // Check if within trading hours
      if (!this.isWithinTradingHours(settings)) {
        console.log(`   🕐 User ${user.email}: Outside trading hours`);
        continue;
      }

      // Check concurrent trades limit
      const hasCapacity = await this.hasTradeCapacity(user.id, settings.maxConcurrentTrades);
      if (!hasCapacity) {
        console.log(`   📊 User ${user.email}: Max concurrent trades reached`);
        continue;
      }

      // User passed all filters
      console.log(`   ✅ User ${user.email}: Eligible`);
      
      eligibleUsers.push({
        userId: user.id,
        userEmail: user.email,
        userName: user.fullName,
        settings,
        accountBalance: 10000, // TODO: Get from trading account
      });
    }

    return eligibleUsers;
  }

  /**
   * Check if symbol is in allowed list
   */
  private isSymbolAllowed(symbol: string, allowedSymbols: string[]): boolean {
    if (allowedSymbols.length === 0) return true; // No filter = all allowed
    return allowedSymbols.includes(symbol.toUpperCase());
  }

  /**
   * Check if current time is within user's trading hours
   */
  private isWithinTradingHours(settings: UserSettings): boolean {
    // If no trading hours set, allow 24/7
    if (!settings.tradingHoursStart || !settings.tradingHoursEnd) {
      return true;
    }

    return isWithinTradingHours(
      new Date(),
      settings.tradingHoursStart,
      settings.tradingHoursEnd
    );
  }

  /**
   * Check if user has capacity for more trades
   */
  private async hasTradeCapacity(userId: string, maxConcurrent: number): Promise<boolean> {
    const openTrades = await this.tradeRepo.count({
      where: {
        user_id: userId,
        status: TradeStatus.OPEN,
      },
    });

    return openTrades < maxConcurrent;
  }

  /**
   * Queue trade execution for a user
   */
  private async queueTradeExecution(signal: Signal, user: UserMatchResult): Promise<void> {
    try {
      if (!this.executionQueue) {
        console.log('⚠️  Execution queue not available - skipping queue');
        // TODO: Execute directly without queue
        return;
      }

      await this.executionQueue.add(
        'execute-trade',
        {
          signalId: signal.id,
          userId: user.userId,
          userEmail: user.userEmail,
          userName: user.userName,
          symbol: signal.symbol,
          direction: signal.direction,
        },
        {
          priority: 1, // High priority
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );

      console.log(`   📤 Queued execution for ${user.userEmail}`);
    } catch (error) {
      console.error(`   ❌ Failed to queue execution for ${user.userEmail}:`, error);
    }
  }

  /**
   * Mark signal as completed after all trades executed
   */
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
      console.error('❌ Error marking signal as completed:', error);
    }
  }

  /**
   * Handle duplicate signal detection
   */
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

    // Check if any recent signal has similar entry price (within 0.1%)
    for (const signal of duplicates) {
      if (signal.signalTime < windowStart) continue;

      const priceDiff = Math.abs(signal.entryMax - entryPrice) / entryPrice;
      if (priceDiff < 0.001) {
        // Within 0.1%
        console.log('🔍 Duplicate signal detected, skipping');
        return signal;
      }
    }

    return null;
  }
}