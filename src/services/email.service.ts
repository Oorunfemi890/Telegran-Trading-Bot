// FILE: src/services/email.service.ts (COMPLETE WITH ALL TEMPLATES)
// =============================================
import nodemailer from "nodemailer";
import AppDataSource from "../config/database.config";
import { EmailLog } from "../database/entities/EmailLog.entity";
import { User } from "../database/entities/User.entity";
import { EmailNotificationType, EmailDeliveryStatus } from "../types";
import { Queue, Worker } from "bullmq";
import { getRedisClient } from "../config/redis.config";

// Import all email templates
import {
  generateInvitationEmail,
  generateWelcomeEmail,
  InvitationEmailData,
  WelcomeEmailData,
} from "../templates/email.templates";
import {
  generateTradeOpenedEmail,
  TradeOpenedData,
} from "../templates/trade-opened.template";
import {
  generateBreakevenActivatedEmail,
  BreakevenActivatedData,
} from "../templates/breakeven-activated.template";
import {
  generateTakeProfitHitEmail,
  TakeProfitHitData,
} from "../templates/takeprofit-hit.template";
import {
  generateStopLossHitEmail,
  StopLossHitData,
} from "../templates/stoploss-hit.template";
import {
  generateTradeCompletedEmail,
  TradeCompletedData,
} from "../templates/trade-completed.template";

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text: string;
  userId?: string;
  emailType: EmailNotificationType;
}

export class EmailService {
  private emailLogRepo = AppDataSource.getRepository(EmailLog);
  private userRepo = AppDataSource.getRepository(User);
  private emailQueue: Queue | null = null;
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
    this.initializeQueue();
  }

  private initializeTransporter() {
    const emailProvider = process.env.EMAIL_PROVIDER || "gmail";

    if (emailProvider === "sendgrid") {
      const sendgridApiKey = process.env.SENDGRID_API_KEY;
      if (sendgridApiKey && sendgridApiKey !== "") {
        this.transporter = nodemailer.createTransport({
          host: "smtp.sendgrid.net",
          port: 587,
          auth: {
            user: "apikey",
            pass: sendgridApiKey,
          },
        });
        console.log("✅ SendGrid transporter initialized");
      }
    } else {
      const emailUser = process.env.EMAIL_USER || process.env.EMAIL_FROM;
      const emailPass =
        process.env.EMAIL_PASSWORD || process.env.EMAIL_APP_PASSWORD;

      if (emailUser && emailPass) {
        this.transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: emailUser,
            pass: emailPass,
          },
        });
        console.log("✅ Gmail transporter initialized");
      }
    }

    if (!this.transporter) {
      console.log(
        "⚠️  Email transporter not initialized - emails will not be sent"
      );
    }
  }

  private initializeQueue() {
    const redis = getRedisClient();

    if (redis && redis.status === "ready") {
      this.emailQueue = new Queue("email-delivery", {
        connection: redis,
      });
      console.log("✅ Email queue initialized");

      this.startWorker();
    } else {
      console.log(
        "⚠️  Email queue not initialized - emails will send directly"
      );
    }
  }

  private startWorker() {
    const redis = getRedisClient();

    if (!redis) return;

    new Worker(
      "email-delivery",
      async (job) => {
        const emailData: EmailData = job.data;
        return await this.sendEmailDirect(emailData);
      },
      {
        connection: redis,
        concurrency: 5,
      }
    );

    console.log("✅ Email worker started");
  }

  /**
   * Queue email for delivery
   */
  private async queueEmail(emailData: EmailData): Promise<void> {
    if (!this.transporter) {
      console.log(
        "📧 Email not sent (transporter disabled):",
        emailData.subject
      );
      return;
    }

    if (this.emailQueue) {
      await this.emailQueue.add("send-email", emailData, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      });
      console.log("📧 Email queued:", emailData.subject);
    } else {
      await this.sendEmailDirect(emailData);
    }
  }

  /**
   * Send email directly
   */
  private async sendEmailDirect(emailData: EmailData): Promise<void> {
    const { to, subject, html, text, userId, emailType } = emailData;

    try {
      if (userId) {
        const userExists = await this.userRepo.findOne({
          where: { id: userId },
        });

        if (!userExists) {
          console.error(`❌ Cannot log email: User ${userId} does not exist`);
        }
      }

      if (!this.transporter) {
        console.log("📧 Email (not sent - transporter disabled):", subject);
        return;
      }

      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || "Trading Bot",
          address: process.env.EMAIL_FROM || "noreply@tradingbot.com",
        },
        to,
        subject,
        text,
        html,
      };

      await this.transporter.sendMail(mailOptions);

      if (userId) {
        const userExists = await this.userRepo.findOne({
          where: { id: userId },
        });

        if (userExists) {
          const emailLog = this.emailLogRepo.create({
            user_id: userId,
            emailType,
            subject,
            status: EmailDeliveryStatus.SENT,
          });
          await this.emailLogRepo.save(emailLog);
        }
      }

      console.log("✅ Email sent:", subject);
    } catch (error: any) {
      console.error("❌ Email send failed:", error.message);

      if (userId) {
        try {
          const userExists = await this.userRepo.findOne({
            where: { id: userId },
          });

          if (userExists) {
            const emailLog = this.emailLogRepo.create({
              user_id: userId,
              emailType,
              subject,
              status: EmailDeliveryStatus.FAILED,
              errorMessage: error.message,
            });
            await this.emailLogRepo.save(emailLog);
          }
        } catch (logError) {
          console.error("❌ Failed to log email error:", logError);
        }
      }

      throw error;
    }
  }

  /**
   * Send invitation code to customer (no userId yet)
   */
  async sendInvitationCodeEmail(data: InvitationEmailData): Promise<void> {
    const { subject, html, text } = generateInvitationEmail(data);

    await this.queueEmail({
      to: data.customerEmail,
      subject,
      html,
      text,
      emailType: EmailNotificationType.INVITATION_CODE,
    });
  }

  /**
   * Send welcome email after registration
   */
  async sendWelcomeEmail(
    data: WelcomeEmailData,
    userId: string
  ): Promise<void> {
    const { subject, html, text } = generateWelcomeEmail(data);

    await this.queueEmail({
      to: data.email,
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
    data: TradeOpenedData,
    userId: string,
    email: string
  ): Promise<void> {
    const { subject, html, text } = generateTradeOpenedEmail(data);

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
   * Send breakeven activated notification
   */
  async sendBreakevenActivatedEmail(
    data: BreakevenActivatedData,
    userId: string,
    email: string
  ): Promise<void> {
    const { subject, html, text } = generateBreakevenActivatedEmail(data);

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
      userId,
      emailType: EmailNotificationType.BREAKEVEN_ACTIVATED,
    });
  }

  /**
   * Send take profit hit notification
   */
  async sendTakeProfitHitEmail(
    data: TakeProfitHitData,
    userId: string,
    email: string
  ): Promise<void> {
    const { subject, html, text } = generateTakeProfitHitEmail(data);

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
      userId,
      emailType: EmailNotificationType.TAKE_PROFIT_HIT,
    });
  }

  /**
   * Send stop loss hit notification
   */
  async sendStopLossHitEmail(
    data: StopLossHitData,
    userId: string,
    email: string
  ): Promise<void> {
    const { subject, html, text } = generateStopLossHitEmail(data);

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
      userId,
      emailType: EmailNotificationType.STOP_LOSS_HIT,
    });
  }

  /**
   * Send trade completed notification
   */
  async sendTradeCompletedEmail(
    data: TradeCompletedData,
    userId: string,
    email: string
  ): Promise<void> {
    const { subject, html, text } = generateTradeCompletedEmail(data);

    await this.queueEmail({
      to: email,
      subject,
      html,
      text,
      userId,
      emailType: EmailNotificationType.TRADE_COMPLETED,
    });
  }
}


interface SubscriptionExpiryData {
  recipientName: string;
  recipientEmail: string;
  tier: string;
  expiryDate: Date;
  daysRemaining: number;
}

/**
 * Send subscription expiry reminder
 */
async sendSubscriptionExpiryReminder(data: SubscriptionExpiryData): Promise<void> {
  if (!emailConfig.enabled || !emailConfig.apiKey) {
    console.log('⚠️  Email notifications disabled');
    return;
  }

  const urgencyLevel = data.daysRemaining === 1 ? 'urgent' : 
                       data.daysRemaining === 3 ? 'warning' : 'info';

  const subject = data.daysRemaining === 1
    ? `⚠️ Your ${data.tier} subscription expires tomorrow!`
    : `Reminder: Your ${data.tier} subscription expires in ${data.daysRemaining} days`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .alert { 
            padding: 15px; 
            border-radius: 6px; 
            margin: 20px 0;
            ${urgencyLevel === 'urgent' ? 'background: #fef2f2; border-left: 4px solid #ef4444;' : 
              urgencyLevel === 'warning' ? 'background: #fffbeb; border-left: 4px solid #f59e0b;' : 
              'background: #eff6ff; border-left: 4px solid #3b82f6;'}
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
            margin: 20px 0;
          }
          .details { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Expiry Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            
            <div class="alert">
              <strong>${urgencyLevel === 'urgent' ? '⚠️ Urgent:' : '📅 Reminder:'}</strong> 
              Your <strong>${data.tier.toUpperCase()}</strong> subscription will expire in 
              <strong>${data.daysRemaining} day${data.daysRemaining > 1 ? 's' : ''}</strong>!
            </div>

            <div class="details">
              <h3>Subscription Details</h3>
              <p><strong>Plan:</strong> ${data.tier.toUpperCase()}</p>
              <p><strong>Expiry Date:</strong> ${new Date(data.expiryDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
              <p><strong>Days Remaining:</strong> ${data.daysRemaining}</p>
            </div>

            <p>To continue enjoying uninterrupted access to your trading bot, please renew your subscription before it expires.</p>

            <center>
              <a href="${process.env.FRONTEND_URL}/subscription/renew" class="button">
                Renew Subscription
              </a>
            </center>

            <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
              Once your subscription expires, your trading bot will be paused until you renew.
            </p>

            <div class="footer">
              <p>Need help? Contact us at support@tradingbot.com</p>
              <p>© ${new Date().getFullYear()} Trading Bot. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const msg = {
    to: data.recipientEmail,
    from: {
      email: emailConfig.fromEmail,
      name: emailConfig.fromName,
    },
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Expiry reminder sent to ${data.recipientEmail}`);
  } catch (error) {
    console.error('❌ Failed to send expiry reminder:', error);
    throw error;
  }
}




interface ChannelApprovalData {
  recipientName: string;
  recipientEmail: string;
  channelTitle: string;
  approved: boolean;
  rejectionReason?: string;
}

/**
 * Send channel approval/rejection email
 */
async sendChannelApprovalEmail(data: ChannelApprovalData): Promise<void> {
  if (!emailConfig.enabled || !emailConfig.apiKey) {
    console.log('⚠️  Email notifications disabled');
    return;
  }

  const subject = data.approved
    ? `✅ Your channel request has been approved!`
    : `❌ Your channel request was not approved`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { 
            background: ${data.approved ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'}; 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 8px 8px 0 0; 
          }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .status-box { 
            padding: 20px; 
            border-radius: 6px; 
            margin: 20px 0;
            background: ${data.approved ? '#f0fdf4' : '#fef2f2'};
            border-left: 4px solid ${data.approved ? '#10b981' : '#ef4444'};
          }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
            margin: 20px 0;
          }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${data.approved ? '✅ Channel Approved!' : '❌ Channel Not Approved'}</h1>
          </div>
          <div class="content">
            <p>Hi ${data.recipientName},</p>
            
            <div class="status-box">
              <h3 style="margin-top: 0;">${data.channelTitle}</h3>
              <p>
                ${data.approved 
                  ? 'Your channel request has been approved! The channel is now active and monitoring signals.' 
                  : 'Unfortunately, your channel request was not approved at this time.'}
              </p>
              ${!data.approved && data.rejectionReason ? `
                <p style="margin-top: 15px;">
                  <strong>Reason:</strong> ${data.rejectionReason}
                </p>
              ` : ''}
            </div>

            ${data.approved ? `
              <p>You can now subscribe to this channel and start receiving signals automatically.</p>
              <center>
                <a href="${process.env.FRONTEND_URL}/channels" class="button">
                  View Channels
                </a>
              </center>
            ` : `
              <p>You can submit a new request with a different channel. Make sure the channel:</p>
              <ul>
                <li>Is a legitimate trading signal channel</li>
                <li>Provides clear trading signals with entry, stop loss, and take profit levels</li>
                <li>Has a good track record</li>
              </ul>
            `}

            <div class="footer">
              <p>Questions? Contact us at support@tradingbot.com</p>
              <p>© ${new Date().getFullYear()} Trading Bot. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const msg = {
    to: data.recipientEmail,
    from: {
      email: emailConfig.fromEmail,
      name: emailConfig.fromName,
    },
    subject,
    html,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Channel ${data.approved ? 'approval' : 'rejection'} email sent to ${data.recipientEmail}`);
  } catch (error) {
    console.error('❌ Failed to send channel approval email:', error);
    throw error;
  }
}
