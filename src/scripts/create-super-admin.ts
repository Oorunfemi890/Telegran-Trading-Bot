
// FILE: src/scripts/create-super-admin.ts

import 'reflect-metadata';
import { config } from 'dotenv';
import AppDataSource from '../database/data-source';
import { User } from '../database/entities/User.entity';
import { UserSettings } from '../database/entities/UserSettings.entity';
import { UserRole, UserStatus, SubscriptionTier } from '../types';

config();

async function createSuperAdmin() {
  try {
    console.log('\n🔧 SUPER ADMIN SETUP\n');
    console.log('==========================================\n');

    // Initialize database
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    const userRepo = AppDataSource.getRepository(User);
    const settingsRepo = AppDataSource.getRepository(UserSettings);

    // Get credentials from environment or use defaults
    const email = process.env.SUPER_ADMIN_EMAIL || 'admin@tradingbot.com';
    const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';
    const fullName = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

    // Check if super admin already exists
    const existingAdmin = await userRepo.findOne({
      where: { email },
    });

    if (existingAdmin) {
      console.log('⚠️  Super admin with this email already exists!');
      console.log(`📧 Email: ${email}`);
      console.log(`🆔 ID: ${existingAdmin.id}`);
      console.log(`👤 Name: ${existingAdmin.fullName}`);
      console.log('\nIf you want to create a new super admin, use a different email in .env\n');
      await AppDataSource.destroy();
      process.exit(0);
    }

    // Create super admin user
    const superAdmin = userRepo.create({
      email,
      fullName,
      password, // Will be hashed automatically by entity hook
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      tier: SubscriptionTier.ENTERPRISE,
      emailVerified: true,
      subscriptionExpiresAt: null, // Never expires for super admin
    });

    await userRepo.save(superAdmin);

    // Create default settings for super admin
    const settings = settingsRepo.create({
      user_id: superAdmin.id,
      balanceUsagePercentage: 10,
      positionsPerTrade: 5,
      maxConcurrentTrades: 10,
      breakevenActivationPips: 25,
      breakevenEnabled: true,
      takeProfitDistribution: [
        { level: 1, positions: 2, pips: 40 },
        { level: 2, positions: 2, pips: 70 },
        { level: 3, positions: 1, pips: 100 },
      ],
      allowedSymbols: [
        'EURUSD',
        'GBPUSD',
        'USDJPY',
        'AUDUSD',
        'USDCAD',
        'XAUUSD',
        'BTCUSD',
        'US30',
      ],
      tradingHoursStart: null,
      tradingHoursEnd: null,
      timezone: 'UTC',
      tradingEnabled: true,
      emailNotificationsEnabled: true,
      tradeOpenedNotification: true,
      breakevenNotification: true,
      takeProfitNotification: true,
      stopLossNotification: true,
      dailyReportEnabled: true,
    });

    await settingsRepo.save(settings);

    console.log('==========================================');
    console.log('✅ SUPER ADMIN CREATED SUCCESSFULLY');
    console.log('==========================================\n');
    console.log(`👤 Name: ${fullName}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🆔 User ID: ${superAdmin.id}`);
    console.log(`🎭 Role: ${UserRole.SUPER_ADMIN}`);
    console.log(`🎯 Tier: ${SubscriptionTier.ENTERPRISE}`);
    console.log('\n==========================================\n');
    console.log('⚠️  IMPORTANT SECURITY NOTES:');
    console.log('1. Change the password immediately after first login');
    console.log('2. Store these credentials securely');
    console.log('3. Never share super admin credentials');
    console.log('4. Use this account only for administrative tasks\n');
    console.log('==========================================\n');
    console.log('📋 Next Steps:');
    console.log('1. Start the server: npm run dev');
    console.log(`2. Login at: ${process.env.APP_URL || 'http://localhost:3000'}/admin/login`);
    console.log('3. Generate invitation codes for customers');
    console.log('4. Configure system settings\n');

    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(1);
  }
}

// Run the script
createSuperAdmin();