// FILE: src/services/admin/user-management.service.ts
// =============================================
// PHASE 11: ADMIN USER MANAGEMENT SERVICE
// =============================================

import AppDataSource from "../../config/database.config";
import { User } from "../../database/entities/User.entity";
import { UserSettings } from "../../database/entities/UserSettings.entity";
import { Trade } from "../../database/entities/Trade.entity";
import {
  UserRole,
  UserStatus,
  SubscriptionTier,
  TradeStatus,
} from "../../types";
import { Between, Like, In } from "typeorm";

export interface UserFilters {
  status?: UserStatus;
  tier?: SubscriptionTier;
  role?: UserRole;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasActiveSubscription?: boolean;
}

export interface UpdateUserDTO {
  fullName?: string;
  status?: UserStatus;
  role?: UserRole;
  tier?: SubscriptionTier;
  subscriptionExpiresAt?: Date | null;
  emailVerified?: boolean;
}

export class AdminUserManagementService {
  private userRepo = AppDataSource.getRepository(User);
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private tradeRepo = AppDataSource.getRepository(Trade);

  /**
   * Get all users with filters and pagination
   */
  async getAllUsers(
    filters: UserFilters,
    page: number = 1,
    limit: number = 50
  ) {
    const query = this.userRepo
      .createQueryBuilder("user")
      .leftJoinAndSelect("user.settings", "settings")
      .leftJoinAndSelect("user.invitationCode", "invitationCode");

    // Apply filters
    if (filters.status) {
      query.andWhere("user.status = :status", { status: filters.status });
    }

    if (filters.tier) {
      query.andWhere("user.tier = :tier", { tier: filters.tier });
    }

    if (filters.role) {
      query.andWhere("user.role = :role", { role: filters.role });
    }

    if (filters.search) {
      query.andWhere(
        "(user.fullName LIKE :search OR user.email LIKE :search)",
        { search: `%${filters.search}%` }
      );
    }

    if (filters.dateFrom && filters.dateTo) {
      query.andWhere("user.createdAt BETWEEN :dateFrom AND :dateTo", {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
    }

    if (filters.hasActiveSubscription !== undefined) {
      if (filters.hasActiveSubscription) {
        query.andWhere(
          "(user.subscriptionExpiresAt IS NULL OR user.subscriptionExpiresAt > :now)",
          { now: new Date() }
        );
      } else {
        query.andWhere(
          "user.subscriptionExpiresAt IS NOT NULL AND user.subscriptionExpiresAt <= :now",
          { now: new Date() }
        );
      }
    }

    // Count total
    const total = await query.getCount();

    // Pagination
    const users = await query
      .orderBy("user.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID with full details
   */
  async getUserById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ["settings", "invitationCode", "tradingAccounts", "trades"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  /**
   * Update user
   */
  async updateUser(id: string, updates: UpdateUserDTO): Promise<User> {
    const user = await this.getUserById(id);

    Object.assign(user, updates);

    await this.userRepo.save(user);

    return user;
  }

  /**
   * Suspend user account
   */
  async suspendUser(id: string, _reason?: string): Promise<User> {
    const user = await this.getUserById(id);

    user.status = UserStatus.SUSPENDED;
    await this.userRepo.save(user);

    // TODO: Close all open trades
    // TODO: Send notification email

    return user;
  }

  /**
   * Activate user account
   */
  async activateUser(id: string): Promise<User> {
    const user = await this.getUserById(id);

    user.status = UserStatus.ACTIVE;
    await this.userRepo.save(user);

    return user;
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(id: string): Promise<void> {
    const user = await this.getUserById(id);

    // Close all open trades first
    // TODO: Implement trade closure

    // Mark as suspended
    user.status = UserStatus.SUSPENDED;
    await this.userRepo.save(user);
  }

  /**
   * Extend user subscription
   */
  async extendSubscription(id: string, days: number): Promise<User> {
    const user = await this.getUserById(id);

    const currentExpiry = user.subscriptionExpiresAt || new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + days);

    user.subscriptionExpiresAt = newExpiry;
    await this.userRepo.save(user);

    return user;
  }

  /**
   * Change user tier
   */
  async changeUserTier(id: string, newTier: SubscriptionTier): Promise<User> {
    const user = await this.getUserById(id);

    user.tier = newTier;

    // Update settings based on tier
    const settings = await this.settingsRepo.findOne({
      where: { user_id: id },
    });

    if (settings) {
      this.updateSettingsForTier(settings, newTier);
      await this.settingsRepo.save(settings);
    }

    await this.userRepo.save(user);

    return user;
  }

  /**
   * Update settings based on tier
   */
  private updateSettingsForTier(
    settings: UserSettings,
    tier: SubscriptionTier
  ): void {
    const tierDefaults = {
      [SubscriptionTier.FREE]: {
        positionsPerTrade: 3,
        maxConcurrentTrades: 1,
      },
      [SubscriptionTier.STARTER]: {
        positionsPerTrade: 5,
        maxConcurrentTrades: 3,
      },
      [SubscriptionTier.PRO]: {
        positionsPerTrade: 10,
        maxConcurrentTrades: 5,
      },
      [SubscriptionTier.ENTERPRISE]: {
        positionsPerTrade: 20,
        maxConcurrentTrades: 10,
      },
    };

    const defaults = tierDefaults[tier];
    Object.assign(settings, defaults);
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(id: string): Promise<any> {
    const user = await this.getUserById(id);

    // Get trade statistics
    const [totalTrades, openTrades, closedTrades, trades] = await Promise.all([
      this.tradeRepo.count({ where: { user_id: id } }),
      this.tradeRepo.count({
        where: { user_id: id, status: TradeStatus.OPEN },
      }),
      this.tradeRepo.count({
        where: { user_id: id, status: TradeStatus.CLOSED },
      }),
      this.tradeRepo.find({
        where: { user_id: id, status: TradeStatus.CLOSED },
      }),
    ]);

    // Calculate P&L
    const winningTrades = trades.filter((t) => t.netProfit > 0);
    const losingTrades = trades.filter((t) => t.netProfit < 0);
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.netProfit, 0);
    const totalLoss = Math.abs(
      losingTrades.reduce((sum, t) => sum + t.netProfit, 0)
    );

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        tier: user.tier,
        status: user.status,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      subscription: {
        tier: user.tier,
        expiresAt: user.subscriptionExpiresAt,
        isActive: user.hasValidSubscription(),
        daysRemaining: this.calculateDaysRemaining(user.subscriptionExpiresAt),
      },
      trading: {
        totalTrades,
        openTrades,
        closedTrades,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate:
          totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0,
        totalProfit,
        totalLoss,
        netProfit: totalProfit - totalLoss,
      },
    };
  }

  /**
   * Calculate days remaining in subscription
   */
  private calculateDaysRemaining(expiresAt: Date | null): number | null {
    if (!expiresAt) return null;

    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return days > 0 ? days : 0;
  }

  /**
   * Get system-wide user statistics
   */
  async getSystemStatistics(): Promise<any> {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      freeUsers,
      paidUsers,
      recentRegistrations,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { status: UserStatus.ACTIVE } }),
      this.userRepo.count({ where: { status: UserStatus.SUSPENDED } }),
      this.userRepo.count({ where: { tier: SubscriptionTier.FREE } }),
      this.userRepo.count({
        where: {
          tier: In([
            SubscriptionTier.STARTER,
            SubscriptionTier.PRO,
            SubscriptionTier.ENTERPRISE,
          ]),
        },
      }),
      this.getRecentRegistrations(),
    ]);

    // User growth trends
    const growthTrends = await this.getUserGrowthTrends();

    // Tier distribution
    const tierDistribution = await this.getTierDistribution();

    return {
      overview: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        freeUsers,
        paidUsers,
        conversionRate: totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0,
      },
      recentRegistrations,
      growthTrends,
      tierDistribution,
    };
  }

  /**
   * Get recent registrations (last 7 days)
   */
  private async getRecentRegistrations() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return await this.userRepo.count({
      where: {
        createdAt: Between(sevenDaysAgo, new Date()),
      },
    });
  }

  /**
   * Get user growth trends (last 30 days)
   */
  private async getUserGrowthTrends(): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const users = await this.userRepo.find({
      where: {
        createdAt: Between(thirtyDaysAgo, new Date()),
      },
      order: { createdAt: "ASC" },
    });

    // Group by day
    const trends: { [key: string]: number } = {};

    users.forEach((user) => {
      const date = user.createdAt.toISOString().split("T")[0];
      trends[date] = (trends[date] || 0) + 1;
    });

    return Object.entries(trends).map(([date, count]) => ({
      date,
      registrations: count,
    }));
  }

  /**
   * Get tier distribution
   */
  private async getTierDistribution(): Promise<any[]> {
    const result = await this.userRepo
      .createQueryBuilder("user")
      .select("user.tier", "tier")
      .addSelect("COUNT(*)", "count")
      .groupBy("user.tier")
      .getRawMany();

    return result.map((r) => ({
      tier: r.tier,
      count: parseInt(r.count || "0"),
    }));
  }

  /**
   * Search users
   */
  async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    return await this.userRepo.find({
      where: [{ fullName: Like(`%${query}%`) }, { email: Like(`%${query}%`) }],
      take: limit,
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get users by tier
   */
  async getUsersByTier(tier: SubscriptionTier): Promise<User[]> {
    return await this.userRepo.find({
      where: { tier },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Get expired subscriptions
   */
  async getExpiredSubscriptions(): Promise<User[]> {
    return await this.userRepo
      .createQueryBuilder("user")
      .where("user.subscriptionExpiresAt IS NOT NULL")
      .andWhere("user.subscriptionExpiresAt < :now", { now: new Date() })
      .andWhere("user.status = :status", { status: UserStatus.ACTIVE })
      .orderBy("user.subscriptionExpiresAt", "ASC")
      .getMany();
  }

  /**
   * Promote user to admin
   */
  async promoteToAdmin(userId: string, promotedBy: string): Promise<User> {
    // Only super admin can promote
    const promoter = await this.userRepo.findOne({ where: { id: promotedBy } });
    if (!promoter || promoter.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Only super admin can promote users to admin");
    }

    const user = await this.getUserById(userId);
    user.role = UserRole.ADMIN;

    await this.userRepo.save(user);

    return user;
  }

  /**
   * Demote admin to user
   */
  async demoteToUser(userId: string, demotedBy: string): Promise<User> {
    // Only super admin can demote
    const demoter = await this.userRepo.findOne({ where: { id: demotedBy } });
    if (!demoter || demoter.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Only super admin can demote admins");
    }

    const user = await this.getUserById(userId);

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new Error("Cannot demote super admin");
    }

    user.role = UserRole.USER;

    await this.userRepo.save(user);

    return user;
  }
}
