// FILE: src/services/email.service.ts (CLEANED - ALL TEMPLATES SEPARATED)
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
import {
  generateSubscriptionExpiryEmail,
  SubscriptionExpiryData,
} from "../templates/subscription-expiry.template";
import {
  generateChannelApprovalEmail,
  ChannelApprovalData,
} from "../templates/channel-approval.template";

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

  /**
   * Send subscription expiry reminder
   */
  async sendSubscriptionExpiryReminder(data: SubscriptionExpiryData): Promise<void> {
    const { subject, html, text } = generateSubscriptionExpiryEmail(data);

    await this.queueEmail({
      to: data.recipientEmail,
      subject,
      html,
      text,
      emailType: EmailNotificationType.SUBSCRIPTION_EXPIRY,
    });
  }

  /**
   * Send channel approval/rejection email
   */
  async sendChannelApprovalEmail(data: ChannelApprovalData): Promise<void> {
    const { subject, html, text } = generateChannelApprovalEmail(data);

    await this.queueEmail({
      to: data.recipientEmail,
      subject,
      html,
      text,
      emailType: EmailNotificationType.CHANNEL_APPROVAL,
    });
  }
}