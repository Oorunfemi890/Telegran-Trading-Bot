// FILE: src/services/auth.service.ts (UPDATED WITH LOCATION TRACKING)
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
import { getWebSocketServer } from "../websocket/socket.server";
import { getLocationFromIP, parseUserAgent, getClientIP } from '../helpers/location.helper';

export interface RegisterDTO {
  email: string;
  fullName: string;
  password: string;
  invitationCode: string;
  phoneNumber?: string;
  country?: string;
  req?: any; // Express request object for IP/device tracking
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
   * Register a new user with invitation code (UPDATED)
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

    // ✅ GET LOCATION DATA IF REQUEST OBJECT PROVIDED
    let locationData: any = {};
    let deviceInfo: any = null;

    if (data.req) {
      try {
        const clientIP = getClientIP(data.req);
        const userAgent = data.req.headers['user-agent'] || '';

        console.log(`📍 Registration IP: ${clientIP}`);

        // Get location from IP (if not localhost)
        if (clientIP && clientIP !== 'Unknown' && !clientIP.includes('127.0.0.1') && !clientIP.includes('::1')) {
          locationData = await getLocationFromIP(clientIP);
          console.log('📍 Location data:', locationData);
        }

        // Parse device info
        deviceInfo = parseUserAgent(userAgent);
        deviceInfo.userAgent = userAgent;
        console.log('📱 Device info:', deviceInfo);
      } catch (error) {
        console.error('⚠️  Failed to get location/device info:', error);
        // Continue with registration even if location tracking fails
      }
    }

    // Create user with location data
    const user = this.userRepo.create({
      email: data.email.toLowerCase(),
      fullName: data.fullName,
      password: data.password,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      tier: invitation.tier,
      invitation_code_id: invitation.id,
      emailVerified: true,
      subscriptionExpiresAt: this.calculateSubscriptionExpiry(invitation.tier),
      // ✅ LOCATION & DEVICE TRACKING
      phoneNumber: data.phoneNumber || null,
      country: data.country || locationData.country || null,
      city: locationData.city || null,
      registrationIp: data.req ? getClientIP(data.req) : null,
      deviceInfo: deviceInfo,
    });

    await this.userRepo.save(user);

    console.log(`✅ User registered with location: ${user.country || 'Unknown'}, ${user.city || 'Unknown'}`);

    // Create default settings
    const settings = this.createDefaultSettings(user.id, invitation.tier);
    await this.settingsRepo.save(settings);

    // Mark invitation as used
    invitation.markAsUsed();
    await this.invitationRepo.save(invitation);

    // Emit WebSocket event to admins
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.emitNewUserRegistration({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        tier: user.tier,
        createdAt: user.createdAt,
        invitationCode: invitation.code,
        country: user.country,
        city: user.city,
        registrationIp: user.registrationIp,
      });
      console.log("📡 WebSocket: New user registration event sent to admins");
    }

    // Send welcome email
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
   * Login existing user (UPDATED)
   */
  async login(data: LoginDTO, req?: any): Promise<AuthResponse> {
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

    // Update last login with IP tracking
    user.lastLoginAt = new Date();
    if (req) {
      user.lastLoginIp = getClientIP(req);
    }
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
      return "If your email is registered, you will receive a reset link";
    }

    const resetToken = generateRandomToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    user.passwordResetToken = resetToken;
    user.passwordResetExpiresAt = expiresAt;
    await this.userRepo.save(user);

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

    user.password = newPassword;
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await this.userRepo.save(user);

    return true;
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await user.validatePassword(currentPassword);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    user.password = newPassword;
    await this.userRepo.save(user);
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
      return null;
    }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
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
      tradingEnabled: false,
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