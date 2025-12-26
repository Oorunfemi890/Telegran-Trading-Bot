// FILE: src/services/auth.service.ts
// =============================================
import AppDataSource from "../config/database.config";
import { User } from "../database/entities/User.entity";
import { UserSettings } from "../database/entities/UserSettings.entity";
import { InvitationCode } from "../database/entities/InvitationCode.entity";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../helpers/jwt.helper";
import { generateRandomToken } from "../helpers/encryption.helper";
import { UserRole, UserStatus, SubscriptionTier } from "../types";
import { EmailService } from "./email.service";

export interface RegisterDTO {
  email: string;
  fullName: string;
  password: string;
  invitationCode: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Partial<User>;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private userRepo = AppDataSource.getRepository(User);
  private settingsRepo = AppDataSource.getRepository(UserSettings);
  private invitationRepo = AppDataSource.getRepository(InvitationCode);
  private emailService = new EmailService();

  /**
   * Register a new user with invitation code
   */
  async register(data: RegisterDTO): Promise<AuthResponse> {
    // Validate invitation code
    const invitation = await this.invitationRepo.findOne({
      where: { code: data.invitationCode },
    });

    if (!invitation) {
      throw new Error("Invalid invitation code");
    }

    if (!invitation.isValid()) {
      throw new Error("Invitation code is expired or already used");
    }

    if (!invitation.canBeUsedBy(data.email)) {
      throw new Error("This invitation code is not valid for your email");
    }

    // Check if user already exists
    const existingUser = await this.userRepo.findOne({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Create user - NO EMAIL VERIFICATION NEEDED
    // Since they purchased the invitation code with this email, we trust it
    const user = this.userRepo.create({
      email: data.email.toLowerCase(),
      fullName: data.fullName,
      password: data.password, // Will be hashed by entity hook
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      tier: invitation.tier,
      invitation_code_id: invitation.id,
      emailVerified: true, // Auto-verify since they used their email to purchase
      subscriptionExpiresAt: this.calculateSubscriptionExpiry(invitation.tier),
    });

    await this.userRepo.save(user);

    // Create default settings based on tier
    const settings = this.createDefaultSettings(user.id, invitation.tier);
    await this.settingsRepo.save(settings);

    // Mark invitation as used
    invitation.markAsUsed();
    await this.invitationRepo.save(invitation);

    // Send welcome email with complete setup instructions
    try {
      await this.emailService.sendWelcomeEmail(
        {
          fullName: user.fullName,
          email: user.email,
          tier: user.tier,
          dashboardUrl: `${process.env.APP_URL || "http://localhost:3000"}/dashboard`,
        },
        user.id
      );
      console.log(`✅ Welcome email sent to ${user.email}`);
    } catch (emailError) {
      console.error("⚠️  Failed to send welcome email:", emailError);
      // Don't fail registration if email fails
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login existing user
   */
  async login(data: LoginDTO): Promise<AuthResponse> {
    // Find user with password
    const user = await this.userRepo.findOne({
      where: { email: data.email.toLowerCase() },
      select: ["id", "email", "fullName", "password", "role", "status", "tier"],
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isValidPassword = await user.validatePassword(data.password);
    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    // Check if account is active
    if (!user.isActive()) {
      throw new Error("Your account is suspended or inactive");
    }

    // Update last login
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists
      return "If your email is registered, you will receive a reset link";
    }

    const resetToken = generateRandomToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    user.passwordResetToken = resetToken;
    user.passwordResetExpiresAt = expiresAt;
    await this.userRepo.save(user);

    // TODO: Send password reset email
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);

    return resetToken;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { passwordResetToken: token },
    });

    if (!user) {
      throw new Error("Invalid or expired reset token");
    }

    if (
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new Error("Reset token has expired");
    }

    user.password = newPassword; // Will be hashed by entity hook
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await this.userRepo.save(user);

    return true;
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ["settings", "invitationCode"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user.toJSON();
  }

  /**
   * Calculate subscription expiry based on tier
   */
  private calculateSubscriptionExpiry(tier: SubscriptionTier): Date | null {
    if (tier === SubscriptionTier.FREE) {
      return null; // Free tier never expires
    }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1); // 1 month subscription
    return expiry;
  }

  /**
   * Create default settings based on tier
   */
  private createDefaultSettings(
    userId: string,
    tier: SubscriptionTier
  ): UserSettings {
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

    return this.settingsRepo.create({
      user_id: userId,
      balanceUsagePercentage: 10,
      positionsPerTrade: defaults.positionsPerTrade,
      maxConcurrentTrades: defaults.maxConcurrentTrades,
      breakevenActivationPips: 25,
      breakevenEnabled: true,
      takeProfitDistribution: [
        {
          level: 1,
          positions: Math.ceil(defaults.positionsPerTrade * 0.4),
          pips: 40,
        },
        {
          level: 2,
          positions: Math.ceil(defaults.positionsPerTrade * 0.4),
          pips: 70,
        },
        {
          level: 3,
          positions: Math.floor(defaults.positionsPerTrade * 0.2),
          pips: 100,
        },
      ],
      allowedSymbols: ["EURUSD", "GBPUSD", "XAUUSD"],
      tradingEnabled: false, // User must connect accounts first
      emailNotificationsEnabled: true,
      tradeOpenedNotification: true,
      breakevenNotification: true,
      takeProfitNotification: true,
      stopLossNotification: true,
      dailyReportEnabled: true,
    });
  }

  /**
   * Validate invitation code
   */
  async validateInvitationCode(code: string, email?: string): Promise<boolean> {
    const invitation = await this.invitationRepo.findOne({
      where: { code },
    });

    if (!invitation) {
      return false;
    }

    if (email) {
      return invitation.canBeUsedBy(email);
    }

    return invitation.isValid();
  }
}
