// FILE: src/templates/invitation-email.template.ts
// =============================================

export interface InvitationEmailData {
  customerName: string;
  customerEmail: string;
  invitationCode: string;
  tier: string;
  price: number;
  expiresAt: Date | null;
  maxUses: number;
}

export const generateInvitationEmail = (data: InvitationEmailData): { subject: string; html: string; text: string } => {
  const expiryText = data.expiresAt 
    ? `This code expires on ${data.expiresAt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    : 'This code never expires';

  const subject = `Your Trading Bot Invitation Code - ${data.tier.toUpperCase()} Plan`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .code-box { background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center; }
    .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 2px; font-family: 'Courier New', monospace; }
    .info-box { background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .steps { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .step { margin: 15px 0; padding-left: 30px; position: relative; }
    .step:before { content: "→"; position: absolute; left: 0; color: #667eea; font-weight: bold; font-size: 20px; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .highlight { color: #667eea; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome to Trading Bot!</h1>
      <p style="margin: 10px 0 0 0;">Your invitation code is ready</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.customerName},</p>
      
      <p>Thank you for purchasing the <strong>${data.tier.toUpperCase()}</strong> plan! We're excited to have you on board.</p>
      
      <div class="code-box">
        <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">Your Invitation Code</p>
        <div class="code">${data.invitationCode}</div>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">${expiryText}</p>
      </div>
      
      <div class="info-box">
        <strong>📦 Plan Details:</strong><br>
        • Tier: <span class="highlight">${data.tier.toUpperCase()}</span><br>
        • Price: <span class="highlight">$${data.price}</span><br>
        • Uses: <span class="highlight">${data.maxUses} time${data.maxUses > 1 ? 's' : ''}</span>
      </div>
      
      <h3>🚀 Get Started in 3 Easy Steps:</h3>
      
      <div class="steps">
        <div class="step">
          <strong>Visit Registration Page</strong><br>
          Go to ${process.env.APP_URL}/register and enter your invitation code
        </div>
        
        <div class="step">
          <strong>Create Your Account</strong><br>
          Fill in your details and activate your account instantly
        </div>
        
        <div class="step">
          <strong>Connect & Start Trading</strong><br>
          Link your Telegram and MetaTrader to begin automated trading
        </div>
      </div>
      
      <center>
        <a href="${process.env.APP_URL}/register?code=${data.invitationCode}" class="cta-button">
          Activate Your Account Now →
        </a>
      </center>
      
      <p>Questions? Reply to this email or contact our support team.</p>
      
      <p style="margin-top: 30px;">
        Best regards,<br>
        <strong>The Trading Bot Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Trading Bot. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Welcome to Trading Bot!

Your Invitation Code: ${data.invitationCode}

Plan Details:
- Tier: ${data.tier.toUpperCase()}
- Price: $${data.price}
- ${expiryText}

Get Started:
1. Visit ${process.env.APP_URL}/register
2. Enter your invitation code: ${data.invitationCode}
3. Create your account and start trading!

Questions? Reply to this email.

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};