import { CronJob } from 'cron';
import { SubscriptionTier, UserStatus } from '../types';
import AppDataSource from '../config/database.config';
import { User } from '../database/entities/User.entity';
import { EmailService } from '../services/email.service';
import { Between, Not, IsNull } from 'typeorm';

const emailService = new EmailService();
let reminderJob: CronJob | null = null;

/**
 * Check for expiring subscriptions and send reminder emails
 */
async function checkExpiringSubscriptions() {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const now = new Date();

    // Get dates for different reminder periods
    const oneWeekFromNow = new Date(now);
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

      // Find users with subscriptions expiring in 7 days
    const expiringIn7Days = await userRepo.find({
      where: {
        subscriptionExpiresAt: Between(now, oneWeekFromNow),
        status: UserStatus.ACTIVE as any,
        tier: Not(SubscriptionTier.FREE as any),
      },
    });

    // Find users with subscriptions expiring in 3 days
    const expiringIn3Days = await userRepo.find({
      where: {
        subscriptionExpiresAt: Between(now, threeDaysFromNow),
        status: UserStatus.ACTIVE as any,
        tier: Not(SubscriptionTier.FREE as any),
      },
    });

    // Find users with subscriptions expiring tomorrow
    const expiringTomorrow = await userRepo.find({
      where: {
        subscriptionExpiresAt: Between(now, oneDayFromNow),
        status: UserStatus.ACTIVE as any,
        tier: Not(SubscriptionTier.FREE as any),
      },
    });

    console.log(`📧 Sending subscription reminders:`);
    console.log(`   - 7 days: ${expiringIn7Days.length} users`);
    console.log(`   - 3 days: ${expiringIn3Days.length} users`);
    console.log(`   - 1 day: ${expiringTomorrow.length} users`);

    // Send reminders for 7-day expiry
    for (const user of expiringIn7Days) {
      await sendExpiryReminder(user, 7);
    }

    // Send reminders for 3-day expiry
    for (const user of expiringIn3Days) {
      await sendExpiryReminder(user, 3);
    }

    // Send reminders for 1-day expiry
    for (const user of expiringTomorrow) {
      await sendExpiryReminder(user, 1);
    }
  } catch (error) {
    console.error('❌ Error checking expiring subscriptions:', error);
  }
}

/**
 * Send expiry reminder email
 */
async function sendExpiryReminder(user: User, daysRemaining: number) {
  try {
    await emailService.sendSubscriptionExpiryReminder({
      recipientName: user.fullName,
      recipientEmail: user.email,
      tier: user.tier,
      expiryDate: user.subscriptionExpiresAt!,
      daysRemaining,
    });

    console.log(`✅ Sent ${daysRemaining}-day reminder to ${user.email}`);
  } catch (error) {
    console.error(`❌ Failed to send reminder to ${user.email}:`, error);
  }
}

/**
 * Start subscription reminder job
 * Runs daily at 9:00 AM
 */
export function startSubscriptionReminderJob() {
  if (reminderJob) {
    console.log('⚠️  Subscription reminder job already running');
    return;
  }

  // Run at 9:00 AM every day
  reminderJob = new CronJob(
    '0 9 * * *',
    checkExpiringSubscriptions,
    null,
    true,
    'UTC'
  );

  console.log('✅ Subscription reminder job started (9:00 AM UTC daily)');
}

/**
 * Stop subscription reminder job
 */
export function stopSubscriptionReminderJob() {
  if (reminderJob) {
    reminderJob.stop();
    reminderJob = null;
    console.log('✅ Subscription reminder job stopped');
  }
}