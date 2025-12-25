// FILE: src/services/email.service.ts
// =============================================
import sgMail from '../config/email.config';
import { emailConfig } from '../config/email.config';
import AppDataSource from '../config/database.config';
import { EmailLog } from '../database/entities/EmailLog.entity';
import { EmailNotificationType, EmailDeliveryStatus } from '../types';
import { Queue, Worker } from 'bullmq';
import { getRedisClient } from '../config/redis.config';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
  userId: string;
  emailType: EmailNotificationType;
}

export class EmailService {
  private emailLogRepo = AppDataSource.getRepository(EmailLog);
  private emailQueue: Queue | null = null;

  constructor() {
    this.initializeQueue();
  }

  private initializeQueue() {
    const redis = getRedisClient();
    
    if (redis && redis.status === 'ready') {
      this.emailQueue = new Queue('email-delivery', {
        connection: redis,
      });
      console.log('✅ Email queue initialized');
      
      // Start worker
      this.startWorker();
    } else {
      console.log('⚠️  Email queue not initialized - Redis unavailable');
    }
  }

  private startWorker() {
    const redis = getRedisClient();
    
    if (!redis) return;

    new Worker(
      'email-delivery',
      async (job) => {
        const emailData: EmailData = job.data;
        return await this.sendEmailDirect(emailData);
      },
      {
        connection: redis,
        concurrency: 5, // Process 5 emails concurrently
      }
    );

    console.log('✅ Email worker started');
  }

  /**
   * Queue email for delivery
   */
  async queueEmail(emailData: EmailData): Promise<void> {
    if (!emailConfig.enabled) {
      console.log('📧 Email queued (but sending disabled):', emailData.subject);
      return;
    }

    if (this.emailQueue) {
      await this.emailQueue.add('send-email', emailData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });
      console.log('📧 Email queued:', emailData.subject);
    } else {
      // Fallback: send directly if no queue
      await this.sendEmailDirect(emailData);
    }
  }

  /**
   * Send email directly (used by worker or as fallback)
   */
  private async sendEmailDirect(emailData: EmailData): Promise<void> {
    const { to, subject, html, text, userId, emailType } = emailData;

    // Create log entry
    const emailLog = this.emailLogRepo.create({
      user_id: userId,
      emailType,
      subject,
      status: EmailDeliveryStatus.QUEUED,
    });

    try {
      if (!emailConfig.enabled || !emailConfig.apiKey) {
        console.log('📧 Email (not sent - disabled):', subject);
        emailLog.status = EmailDeliveryStatus.FAILED;
        emailLog.errorMessage = 'Email service disabled';
        await this.emailLogRepo.save(emailLog);
        return;
      }

      const msg = {
        to,
        from: {
          email: emailConfig.fromEmail,
          name: emailConfig.fromName,
        },
        subject,
        text,
        html,
      };

      await sgMail.send(msg);

      emailLog.status = EmailDeliveryStatus.SENT;
      await this.emailLogRepo.save(emailLog);

      console.log('✅ Email sent:', subject);
    } catch (error: any) {
      console.error('❌ Email send failed:', error.message);
      
      emailLog.status = EmailDeliveryStatus.FAILED;
      emailLog.errorMessage = error.message;
      await this.emailLogRepo.save(emailLog);

      throw error;
    }
  }

  /**
   * Send welcome email after registration
   */
  async sendWelcomeEmail(
    email: string,
    fullName: string,
    userId: string
  ): Promise<void> {
    const subject = `Welcome to ${emailConfig.fromName}!`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome ${fullName}! 🎉</h2>
        <p>Your trading bot account has been created successfully.</p>
        
        <h3>Next Steps:</h3>
        <ol>
          <li>Configure your risk settings</li>
          <li>Connect your MetaTrader account</li>
          <li>Subscribe to signal channels</li>
          <li>Start automated trading!</li>
        </ol>
        
        <p>Need help? Reply to this email or visit our support center.</p>
        
        <p>Happy Trading!<br>The Trading Bot Team</p>
      </div>
    `;

    const text = `Welcome ${fullName}! Your trading bot account has been created successfully.`;

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
      userId,
      emailType: EmailNotificationType.WELCOME,
    });
  }

  /**
   * Send trade opened notification
   */
  async sendTradeOpenedEmail(
    email: string,
    userId: string,
    tradeDetails: any
  ): Promise<void> {
    const subject = `🔔 Trade Opened: ${tradeDetails.symbol} ${tradeDetails.direction.toUpperCase()}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Trade Opened Successfully! 🎯</h2>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Symbol:</strong> ${tradeDetails.symbol}</p>
          <p><strong>Direction:</strong> ${tradeDetails.direction.toUpperCase()}</p>
          <p><strong>Positions:</strong> ${tradeDetails.totalPositions}</p>
          <p><strong>Lot Size:</strong> ${tradeDetails.lotSize} per position</p>
          <p><strong>Stop Loss:</strong> ${tradeDetails.stopLoss}</p>
          <p><strong>Take Profits:</strong> ${tradeDetails.takeProfits.map((tp: any) => tp.price).join(', ')}</p>
          <p><strong>Risk Amount:</strong> $${tradeDetails.riskAmount.toFixed(2)}</p>
        </div>
        
        <p>All positions have been placed successfully. We'll notify you of any updates!</p>
        
        <p>Good luck!<br>The Trading Bot Team</p>
      </div>
    `;

    const text = `Trade opened: ${tradeDetails.symbol} ${tradeDetails.direction.toUpperCase()}`;

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
      userId,
      emailType: EmailNotificationType.TRADE_OPENED,
    });
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(
    email: string,
    fullName: string,
    userId: string,
    verificationToken: string
  ): Promise<void> {
    const verificationUrl = `${process.env.APP_URL}/api/v1/auth/verify-email/${verificationToken}`;
    
    const subject = 'Verify Your Email Address';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verify Your Email Address</h2>
        <p>Hi ${fullName},</p>
        <p>Please click the button below to verify your email address:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background: #007bff; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Verify Email
          </a>
        </div>
        
        <p>Or copy and paste this link:</p>
        <p style="color: #666; font-size: 14px;">${verificationUrl}</p>
        
        <p>This link expires in 24 hours.</p>
        
        <p>If you didn't create an account, please ignore this email.</p>
      </div>
    `;

    const text = `Verify your email: ${verificationUrl}`;

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
      userId,
      emailType: EmailNotificationType.WELCOME,
    });
  }
}