// FILE: src/services/user-settings.service.ts
// =============================================
// Complete User Settings Management Service
// =============================================

import AppDataSource from '../config/database.config';
import { UserSettings } from '../database/entities/UserSettings.entity';
import { User } from '../database/entities/User.entity';
import { TradingAccount } from '../database/entities/TradingAccount.entity';

export interface UpdateSettingsDTO {
  // Risk Management
  balanceUsagePercentage?: number;
  positionsPerTrade?: number;
  maxConcurrentTrades?: number;
  breakevenActivationPips?: number;
  breakevenEnabled?: boolean;

  // Take Profit Distribution
  takeProfitDistribution?: Array<{
    level: number;
    positions: number;
    pips: number;
  }>;

  // Trading Preferences
  allowedSymbols?: string[];
  tradingHoursStart?: string;
  tradingHoursEnd?: string;
  timezone?: string;
  tradingEnabled?: boolean;

  // Notifications
  emailNotificationsEnabled?: boolean;
  tradeOpenedNotification?: boolean;
  breakevenNotification?: boolean;
  takeProfitNotification?: boolean;
  stopLossNotification?: boolean;
  dailyReportEnabled?: boolean;
}

export interface UpdateProfileDTO {
  fullName?: string;
  phoneNumber?: string;
  country?: string;
  city?: string;
}

export interface UpdateTradingAccountDTO {
  broker?: string;
  accountNumber?: string;
  apiKey?: string;
  apiSecret?: string;
  leverage?: number;
}

export class UserSettingsService {
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private userRepo = AppDataSource.getRepository(User);
  private accountRepo = AppDataSource.getRepository(TradingAccount);

  /**
   * Get user settings (creates default if not exists)
   */
  async getUserSettings(userId: string): Promise<UserSettings> {
    let settings = await this.settingsRepo.findOne({
      where: { user_id: userId },
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await this.createDefaultSettings(userId);
    }

    return settings;
  }

  /**
   * Get complete user data (profile + settings + account)
   */
  async getCompleteUserData(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['settings', 'tradingAccounts'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    const primaryAccount = user.tradingAccounts.find(acc => acc.isPrimary);

    return {
      profile: {
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        country: user.country,
        city: user.city,
        role: user.role,
        tier: user.tier,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      settings: user.settings || await this.createDefaultSettings(userId),
      tradingAccount: primaryAccount ? {
        id: primaryAccount.id,
        broker: primaryAccount.broker,
        accountNumber: primaryAccount.accountNumber,
        balance: primaryAccount.balance,
        equity: primaryAccount.equity,
        freeMargin: primaryAccount.freeMargin,
        currency: primaryAccount.currency,
        leverage: primaryAccount.leverage,
        lastSyncAt: primaryAccount.lastSyncAt,
      } : null,
    };
  }

  /**
   * Update user settings
   */
  async updateSettings(
    userId: string,
    updates: UpdateSettingsDTO
  ): Promise<UserSettings> {
    const settings = await this.getUserSettings(userId);

    // Validate risk parameters
    if (updates.balanceUsagePercentage !== undefined) {
      if (updates.balanceUsagePercentage < 1 || updates.balanceUsagePercentage > 100) {
        throw new Error('Balance usage must be between 1% and 100%');
      }
      settings.balanceUsagePercentage = updates.balanceUsagePercentage;
    }

    if (updates.positionsPerTrade !== undefined) {
      if (updates.positionsPerTrade < 1 || updates.positionsPerTrade > 20) {
        throw new Error('Positions per trade must be between 1 and 20');
      }
      settings.positionsPerTrade = updates.positionsPerTrade;
    }

    if (updates.maxConcurrentTrades !== undefined) {
      if (updates.maxConcurrentTrades < 1 || updates.maxConcurrentTrades > 10) {
        throw new Error('Max concurrent trades must be between 1 and 10');
      }
      settings.maxConcurrentTrades = updates.maxConcurrentTrades;
    }

    if (updates.breakevenActivationPips !== undefined) {
      if (updates.breakevenActivationPips < 10 || updates.breakevenActivationPips > 100) {
        throw new Error('Breakeven activation must be between 10 and 100 pips');
      }
      settings.breakevenActivationPips = updates.breakevenActivationPips;
    }

    // Update other fields
    if (updates.breakevenEnabled !== undefined) {
      settings.breakevenEnabled = updates.breakevenEnabled;
    }

    if (updates.takeProfitDistribution !== undefined) {
      // Validate TP distribution
      const totalPositions = updates.takeProfitDistribution.reduce(
        (sum, tp) => sum + tp.positions, 0
      );
      if (totalPositions !== settings.positionsPerTrade) {
        throw new Error('TP distribution positions must sum to total positions per trade');
      }
      settings.takeProfitDistribution = updates.takeProfitDistribution;
    }

    if (updates.allowedSymbols !== undefined) {
      settings.allowedSymbols = updates.allowedSymbols;
    }

    if (updates.tradingHoursStart !== undefined) {
      settings.tradingHoursStart = updates.tradingHoursStart;
    }

    if (updates.tradingHoursEnd !== undefined) {
      settings.tradingHoursEnd = updates.tradingHoursEnd;
    }

    if (updates.timezone !== undefined) {
      settings.timezone = updates.timezone;
    }

    if (updates.tradingEnabled !== undefined) {
      settings.tradingEnabled = updates.tradingEnabled;
    }

    // Notification preferences
    if (updates.emailNotificationsEnabled !== undefined) {
      settings.emailNotificationsEnabled = updates.emailNotificationsEnabled;
    }

    if (updates.tradeOpenedNotification !== undefined) {
      settings.tradeOpenedNotification = updates.tradeOpenedNotification;
    }

    if (updates.breakevenNotification !== undefined) {
      settings.breakevenNotification = updates.breakevenNotification;
    }

    if (updates.takeProfitNotification !== undefined) {
      settings.takeProfitNotification = updates.takeProfitNotification;
    }

    if (updates.stopLossNotification !== undefined) {
      settings.stopLossNotification = updates.stopLossNotification;
    }

    if (updates.dailyReportEnabled !== undefined) {
      settings.dailyReportEnabled = updates.dailyReportEnabled;
    }

    return await this.settingsRepo.save(settings);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    updates: UpdateProfileDTO
  ): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (updates.fullName !== undefined) {
      user.fullName = updates.fullName;
    }

    if (updates.phoneNumber !== undefined) {
      user.phoneNumber = updates.phoneNumber;
    }

    if (updates.country !== undefined) {
      user.country = updates.country;
    }

    if (updates.city !== undefined) {
      user.city = updates.city;
    }

    return await this.userRepo.save(user);
  }

  /**
   * Update or create trading account
   */
  async updateTradingAccount(
    userId: string,
    updates: UpdateTradingAccountDTO
  ): Promise<TradingAccount> {
    // Find or create primary trading account
    let account = await this.accountRepo.findOne({
      where: { user_id: userId, isPrimary: true },
    });

    if (!account) {
      account = this.accountRepo.create({
        user_id: userId,
        broker: updates.broker || 'MetaTrader 5',
        accountNumber: updates.accountNumber || '',
        encryptedApiKey: this.encryptApiKey(updates.apiKey || ''),
        encryptedApiSecret: updates.apiSecret ? this.encryptApiKey(updates.apiSecret) : null,
        isPrimary: true,
        isActive: true,
      });
    } else {
      if (updates.broker) account.broker = updates.broker;
      if (updates.accountNumber) account.accountNumber = updates.accountNumber;
      if (updates.apiKey) account.encryptedApiKey = this.encryptApiKey(updates.apiKey);
      if (updates.apiSecret) account.encryptedApiSecret = this.encryptApiKey(updates.apiSecret);
      if (updates.leverage) account.leverage = updates.leverage;
    }

    return await this.accountRepo.save(account);
  }

  /**
   * Create default settings for new user
   */
  private async createDefaultSettings(userId: string): Promise<UserSettings> {
    const defaultSettings = this.settingsRepo.create({
      user_id: userId,
      balanceUsagePercentage: 10.0,
      positionsPerTrade: 5,
      maxConcurrentTrades: 3,
      breakevenActivationPips: 25.0,
      breakevenEnabled: true,
      takeProfitDistribution: [
        { level: 1, positions: 2, pips: 40 },
        { level: 2, positions: 2, pips: 70 },
        { level: 3, positions: 1, pips: 100 },
      ],
      allowedSymbols: ['XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY'],
      timezone: 'UTC',
      tradingEnabled: true,
      emailNotificationsEnabled: true,
      tradeOpenedNotification: true,
      breakevenNotification: true,
      takeProfitNotification: true,
      stopLossNotification: true,
      dailyReportEnabled: true,
    });

    return await this.settingsRepo.save(defaultSettings);
  }

  /**
   * Simple encryption for API keys (use proper encryption in production)
   */
  private encryptApiKey(apiKey: string): string {
    // In production, use proper encryption like crypto.createCipher
    // For now, just base64 encode as placeholder
    return Buffer.from(apiKey).toString('base64');
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(userId: string): Promise<UserSettings> {
    await this.settingsRepo.delete({ user_id: userId });
    return await this.createDefaultSettings(userId);
  }
}