// FILE: src/templates/subscription-expiry.template.ts
// =============================================

export interface SubscriptionExpiryData {
  recipientName: string;
  recipientEmail: string;
  tier: string;
  expiryDate: Date;
  daysRemaining: number;
}

export const generateSubscriptionExpiryEmail = (data: SubscriptionExpiryData): { subject: string; html: string; text: string } => {
  const urgencyLevel = data.daysRemaining === 1 ? 'urgent' : 
                       data.daysRemaining === 3 ? 'warning' : 'info';

  const subject = data.daysRemaining === 1
    ? `⚠️ Your ${data.tier.toUpperCase()} subscription expires tomorrow!`
    : `Reminder: Your ${data.tier.toUpperCase()} subscription expires in ${data.daysRemaining} days`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .alert { 
      padding: 20px; 
      border-radius: 8px; 
      margin: 20px 0;
      ${urgencyLevel === 'urgent' ? 'background: #fef2f2; border-left: 4px solid #ef4444;' : 
        urgencyLevel === 'warning' ? 'background: #fffbeb; border-left: 4px solid #f59e0b;' : 
        'background: #eff6ff; border-left: 4px solid #3b82f6;'}
    }
    .alert-icon { font-size: 48px; text-align: center; margin-bottom: 15px; }
    .details { background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { font-weight: 600; color: #6b7280; }
    .detail-value { font-weight: 700; color: #111827; }
    .button { 
      display: inline-block; 
      padding: 15px 32px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: bold; 
      margin: 20px 0;
      box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);
      transition: transform 0.2s;
    }
    .button:hover { transform: translateY(-2px); }
    .countdown { 
      text-align: center; 
      font-size: 48px; 
      font-weight: bold; 
      color: ${urgencyLevel === 'urgent' ? '#ef4444' : urgencyLevel === 'warning' ? '#f59e0b' : '#3b82f6'};
      margin: 20px 0;
    }
    .info-box { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 10px 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${urgencyLevel === 'urgent' ? '⚠️' : '📅'} Subscription Expiring Soon</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">Action required to continue service</p>
    </div>
    
    <div class="content">
      <p>Hi <strong>${data.recipientName}</strong>,</p>
      
      <div class="alert">
        <div class="alert-icon">${urgencyLevel === 'urgent' ? '⏰' : urgencyLevel === 'warning' ? '⚠️' : 'ℹ️'}</div>
        <div style="text-align: center;">
          <strong style="font-size: 18px;">
            ${urgencyLevel === 'urgent' ? 'Urgent Notice' : 'Subscription Reminder'}
          </strong>
        </div>
        <div class="countdown">${data.daysRemaining}</div>
        <p style="text-align: center; margin: 0; font-size: 16px;">
          Day${data.daysRemaining > 1 ? 's' : ''} remaining on your <strong>${data.tier.toUpperCase()}</strong> plan
        </p>
      </div>

      <div class="details">
        <h3 style="margin-top: 0; color: #111827;">📋 Subscription Details</h3>
        <div class="detail-row">
          <span class="detail-label">Current Plan</span>
          <span class="detail-value">${data.tier.toUpperCase()}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Expiry Date</span>
          <span class="detail-value">${new Date(data.expiryDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Days Remaining</span>
          <span class="detail-value" style="color: ${urgencyLevel === 'urgent' ? '#ef4444' : urgencyLevel === 'warning' ? '#f59e0b' : '#3b82f6'};">
            ${data.daysRemaining}
          </span>
        </div>
      </div>

      <p style="font-size: 16px; line-height: 1.8;">
        To continue enjoying uninterrupted access to your automated trading bot and all premium features, 
        please renew your subscription before it expires.
      </p>

      <center>
        <a href="${process.env.APP_URL || process.env.FRONTEND_URL}/subscription/renew" class="button">
          🔄 Renew Subscription Now
        </a>
      </center>

      <div class="info-box">
        <h4 style="margin-top: 0; color: #111827;">⚡ What happens after expiry?</h4>
        <ul style="margin: 10px 0; padding-left: 20px; color: #4b5563;">
          <li>Your trading bot will be paused immediately</li>
          <li>Signal monitoring will stop</li>
          <li>Active trades will be closed safely</li>
          <li>Your account data will be preserved for 30 days</li>
        </ul>
      </div>

      ${urgencyLevel === 'urgent' ? `
      <div style="background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <strong style="color: #dc2626; font-size: 16px;">⚠️ Final Reminder</strong>
        <p style="color: #991b1b; margin: 10px 0 0 0;">
          This is your last day to renew! After tomorrow, all trading will be suspended.
        </p>
      </div>
      ` : ''}

      <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
        Need help or have questions? Contact us at support@tradingbot.com
      </p>

      <div class="footer">
        <p style="margin: 5px 0;"><strong>Trading Bot</strong></p>
        <p style="margin: 5px 0;">Automated Trading Made Simple</p>
        <p style="margin: 15px 0 5px 0;">© ${new Date().getFullYear()} Trading Bot. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
SUBSCRIPTION EXPIRY REMINDER
${urgencyLevel === 'urgent' ? '⚠️ URGENT' : '📅 REMINDER'}

Hi ${data.recipientName},

Your ${data.tier.toUpperCase()} subscription expires in ${data.daysRemaining} day${data.daysRemaining > 1 ? 's' : ''}!

SUBSCRIPTION DETAILS:
- Plan: ${data.tier.toUpperCase()}
- Expiry Date: ${new Date(data.expiryDate).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })}
- Days Remaining: ${data.daysRemaining}

WHAT HAPPENS AFTER EXPIRY:
- Trading bot will be paused
- Signal monitoring stops
- Active trades closed safely
- Account data preserved for 30 days

RENEW NOW:
Visit: ${process.env.APP_URL || process.env.FRONTEND_URL}/subscription/renew

${urgencyLevel === 'urgent' ? '\n⚠️ FINAL REMINDER: This is your last day to renew!\n' : ''}

Questions? Contact: support@tradingbot.com

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};