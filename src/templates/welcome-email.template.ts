// FILE: src/templates/welcome-email.template.ts
// =============================================

export interface WelcomeEmailData {
  fullName: string;
  email: string;
  tier: string;
  dashboardUrl: string;
}

export const generateWelcomeEmail = (data: WelcomeEmailData): { subject: string; html: string; text: string } => {
  const subject = `🎉 Account Activated - Welcome to Trading Bot!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 32px; }
    .content { padding: 30px; }
    .success-badge { background: #4caf50; color: white; display: inline-block; padding: 10px 20px; border-radius: 20px; margin: 20px 0; font-weight: bold; }
    .setup-section { background: #f8f9fa; border-radius: 8px; padding: 25px; margin: 25px 0; }
    .setup-title { color: #667eea; font-size: 20px; margin-bottom: 15px; display: flex; align-items: center; }
    .step-number { background: #667eea; color: white; width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 10px; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
    .info-box { background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
    ul { margin: 10px 0; padding-left: 20px; }
    li { margin: 8px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Welcome Aboard!</h1>
      <p style="margin: 10px 0 0 0; font-size: 18px;">Your account is now active</p>
    </div>
    
    <div class="content">
      <center>
        <div class="success-badge">✓ Account Successfully Activated</div>
      </center>
      
      <p>Hi <strong>${data.fullName}</strong>,</p>
      
      <p>Congratulations! Your <strong>${data.tier.toUpperCase()}</strong> account is now active and ready to use. Let's get you set up for automated trading!</p>
      
      <div class="info-box">
        <strong>📧 Your Login Details:</strong><br>
        Email: <code>${data.email}</code><br>
        Dashboard: <a href="${data.dashboardUrl}">${data.dashboardUrl}</a>
      </div>
      
      <!-- STEP 1: CONNECT TELEGRAM -->
      <div class="setup-section">
        <div class="setup-title">
          <span style="font-size: 24px; margin-right: 10px;">📱</span>
          <strong>Step 1: Connect Your Telegram Account</strong>
        </div>
        
        <p><strong><span class="step-number">1</span> Get Your Telegram API Credentials</strong></p>
        <ul>
          <li>Visit: <a href="https://my.telegram.org" target="_blank">https://my.telegram.org</a></li>
          <li>Log in with your phone number</li>
          <li>Click on "API Development Tools"</li>
          <li>Create a new application:
            <ul>
              <li>App title: "My Trading Bot"</li>
              <li>Short name: "tradingbot" (5-32 characters)</li>
              <li>Platform: Other</li>
            </ul>
          </li>
          <li>Copy your <code>api_id</code> and <code>api_hash</code></li>
        </ul>
        
        <p><strong><span class="step-number">2</span> Add Credentials to Your Dashboard</strong></p>
        <ul>
          <li>Log in to your dashboard</li>
          <li>Go to Settings → Telegram Integration</li>
          <li>Enter your API ID and API Hash</li>
          <li>Click "Connect Telegram"</li>
          <li>Enter the code sent to your Telegram app</li>
        </ul>
        
        <p><strong><span class="step-number">3</span> Choose Signal Channels</strong></p>
        <ul>
          <li>Our bot will scan your Telegram channels</li>
          <li>Select which channels to monitor for signals</li>
          <li>You can add/remove channels anytime</li>
        </ul>
        
        <div class="warning-box">
          <strong>⚠️ Important:</strong> You MUST connect your Telegram account for the bot to monitor signal channels. Without this, automated trading won't work.
        </div>
      </div>
      
      <!-- STEP 2: CONNECT METATRADER -->
      <div class="setup-section">
        <div class="setup-title">
          <span style="font-size: 24px; margin-right: 10px;">📊</span>
          <strong>Step 2: Connect Your Trading Account</strong>
        </div>
        
        <p><strong><span class="step-number">1</span> Get MetaTrader API Access</strong></p>
        <ul>
          <li>Contact your broker for API credentials</li>
          <li>You'll need: Account Number, API Key, API Secret</li>
          <li>Most brokers provide this in your client portal</li>
        </ul>
        
        <p><strong><span class="step-number">2</span> Add Your Trading Account</strong></p>
        <ul>
          <li>Go to Settings → Trading Accounts</li>
          <li>Click "Add New Account"</li>
          <li>Enter your broker and account details</li>
          <li>Your credentials are encrypted and secure</li>
        </ul>
        
        <p><strong><span class="step-number">3</span> Test Connection</strong></p>
        <ul>
          <li>Click "Test Connection" to verify</li>
          <li>Check your account balance is displayed correctly</li>
          <li>Set as "Primary Account" for trading</li>
        </ul>
      </div>
      
      <!-- STEP 3: CONFIGURE RISK SETTINGS -->
      <div class="setup-section">
        <div class="setup-title">
          <span style="font-size: 24px; margin-right: 10px;">⚙️</span>
          <strong>Step 3: Configure Risk Management</strong>
        </div>
        
        <p>Go to Settings → Risk Management and configure:</p>
        
        <ul>
          <li><strong>Risk Per Trade:</strong> Percentage of balance to risk (recommended: 1-2%)</li>
          <li><strong>Positions Per Trade:</strong> How many entries per signal (recommended: 3-5)</li>
          <li><strong>Max Concurrent Trades:</strong> Maximum open trades at once (recommended: 3-5)</li>
          <li><strong>Breakeven Settings:</strong> When to move stop loss to breakeven</li>
          <li><strong>Take Profit Distribution:</strong> How to close positions at TP levels</li>
        </ul>
        
        <div class="warning-box">
          <strong>💡 Pro Tip:</strong> Start with conservative settings (1% risk, 3 positions) until you're comfortable with the system.
        </div>
      </div>
      
      <!-- QUICK START -->
      <div class="setup-section" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
        <div class="setup-title" style="color: white;">
          <span style="font-size: 24px; margin-right: 10px;">🚀</span>
          <strong>You're All Set!</strong>
        </div>
        <p style="margin: 15px 0;">Once you complete the steps above:</p>
        <ul>
          <li>Our bot monitors your selected Telegram channels 24/7</li>
          <li>When a signal is detected, trades are executed automatically</li>
          <li>You receive email notifications for every trade event</li>
          <li>Daily performance reports sent to your inbox</li>
        </ul>
      </div>
      
      <center style="margin: 30px 0;">
        <a href="${data.dashboardUrl}" class="cta-button">
          Go to Dashboard →
        </a>
        <a href="${data.dashboardUrl}/settings" class="cta-button" style="background: #764ba2;">
          Configure Settings →
        </a>
      </center>
      
      <div class="info-box">
        <strong>📚 Need Help?</strong><br>
        • Check our documentation in the dashboard<br>
        • Watch video tutorials (Settings → Tutorials)<br>
        • Contact support: Reply to this email<br>
        • Join our Telegram support group
      </div>
      
      <p style="margin-top: 40px;">We're excited to have you trading with us!</p>
      
      <p>
        Best regards,<br>
        <strong>The Trading Bot Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Trading Bot. All rights reserved.</p>
      <p style="font-size: 12px; color: #999; margin: 10px 0;">
        This email was sent to ${data.email}<br>
        <a href="${data.dashboardUrl}/settings">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
Welcome to Trading Bot!

Hi ${data.fullName},

Your ${data.tier.toUpperCase()} account is now active!

Login Details:
Email: ${data.email}
Dashboard: ${data.dashboardUrl}

SETUP STEPS:

Step 1: Connect Telegram
1. Visit https://my.telegram.org
2. Get your API credentials
3. Add them in Settings → Telegram Integration
4. Select channels to monitor

Step 2: Connect Trading Account
1. Get MetaTrader API access from your broker
2. Add account in Settings → Trading Accounts
3. Test connection and set as primary

Step 3: Configure Risk Management
- Set risk per trade (1-2% recommended)
- Choose positions per trade (3-5 recommended)
- Configure breakeven and take profit settings

Get Started: ${data.dashboardUrl}

Questions? Reply to this email.

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};