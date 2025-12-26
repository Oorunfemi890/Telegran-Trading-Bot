// FILE: src/services/email.service.ts
// =============================================
import nodemailer from "nodemailer";
import AppDataSource from "../config/database.config";
import { EmailLog } from "../database/entities/EmailLog.entity";
import { User } from "../database/entities/User.entity";
import { EmailNotificationType, EmailDeliveryStatus } from "../types";
import { Queue, Worker } from "bullmq";
import { getRedisClient } from "../config/redis.config";
import {
  generateInvitationEmail,
  generateWelcomeEmail,
  InvitationEmailData,
  WelcomeEmailData,
} from "../templates/email.templates";

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
      // Only log if userId is provided
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

      // Create success log only if userId exists and user is in database
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
          <p><strong>Take Profits:</strong> ${tradeDetails.takeProfits.map((tp: any) => tp.price).join(", ")}</p>
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
}
