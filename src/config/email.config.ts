// FILE: src/config/email.config.ts
// =============================================
import sgMail from '@sendgrid/mail';

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
}

export const emailConfig: EmailConfig = {
  apiKey: process.env.SENDGRID_API_KEY || '',
  fromEmail: process.env.EMAIL_FROM || 'noreply@tradingbot.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Trading Bot',
  enabled: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
};

// Initialize SendGrid if enabled and API key exists
if (emailConfig.enabled && emailConfig.apiKey) {
  sgMail.setApiKey(emailConfig.apiKey);
  console.log('✅ SendGrid initialized');
} else {
  console.log('⚠️  Email notifications disabled');
}

export default sgMail;