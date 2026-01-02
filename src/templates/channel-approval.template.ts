// FILE: src/templates/channel-approval.template.ts
// =============================================

export interface ChannelApprovalData {
  recipientName: string;
  recipientEmail: string;
  channelTitle: string;
  approved: boolean;
  rejectionReason?: string;
}

export const generateChannelApprovalEmail = (data: ChannelApprovalData): { subject: string; html: string; text: string } => {
  const subject = data.approved
    ? `✅ Channel Approved: ${data.channelTitle}`
    : `❌ Channel Request Not Approved: ${data.channelTitle}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { 
      background: ${data.approved ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'}; 
      color: white; 
      padding: 40px 20px; 
      text-align: center; 
      border-radius: 10px 10px 0 0;
    }
    .header h1 { margin: 0; font-size: 32px; }
    .status-icon { font-size: 64px; margin: 20px 0; }
    .content { padding: 30px; }
    .status-box { 
      padding: 25px; 
      border-radius: 8px; 
      margin: 20px 0;
      background: ${data.approved ? '#f0fdf4' : '#fef2f2'};
      border-left: 4px solid ${data.approved ? '#10b981' : '#ef4444'};
    }
    .channel-name { 
      font-size: 20px; 
      font-weight: bold; 
      color: #111827;
      margin: 0 0 15px 0;
      padding: 15px;
      background: white;
      border-radius: 6px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .reason-box {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 20px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .button { 
      display: inline-block; 
      padding: 15px 32px; 
      background: ${data.approved ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}; 
      color: white; 
      text-decoration: none; 
      border-radius: 8px; 
      font-weight: bold; 
      margin: 20px 0;
      box-shadow: 0 4px 6px rgba(0,0,0,0.2);
      transition: transform 0.2s;
    }
    .button:hover { transform: translateY(-2px); }
    .info-list { 
      background: #f9fafb; 
      border-radius: 8px; 
      padding: 20px; 
      margin: 20px 0; 
    }
    .info-list ul { margin: 10px 0; padding-left: 20px; }
    .info-list li { margin: 10px 0; color: #4b5563; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-radius: 0 0 10px 10px; }
    .checkmark { color: #10b981; font-size: 20px; }
    .cross { color: #ef4444; font-size: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="status-icon">${data.approved ? '✅' : '❌'}</div>
      <h1>${data.approved ? 'Channel Approved!' : 'Request Not Approved'}</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px;">
        ${data.approved ? 'Your channel is now active!' : 'Review your submission'}
      </p>
    </div>
    
    <div class="content">
      <p>Hi <strong>${data.recipientName}</strong>,</p>
      
      <div class="channel-name">
        📱 ${data.channelTitle}
      </div>
      
      <div class="status-box">
        <h3 style="margin-top: 0; color: ${data.approved ? '#065f46' : '#991b1b'};">
          ${data.approved ? '🎉 Great News!' : 'ℹ️ Status Update'}
        </h3>
        <p style="margin-bottom: 0; font-size: 16px; color: ${data.approved ? '#047857' : '#b91c1c'};">
          ${data.approved 
            ? 'Your channel request has been approved! The channel is now active and monitoring signals 24/7.' 
            : 'After careful review, we are unable to approve your channel request at this time.'}
        </p>
      </div>

      ${!data.approved && data.rejectionReason ? `
        <div class="reason-box">
          <h4 style="margin-top: 0; color: #92400e;">📝 Reason for Rejection</h4>
          <p style="margin: 0; color: #78350f; font-size: 15px;">${data.rejectionReason}</p>
        </div>
      ` : ''}

      ${data.approved ? `
        <h3 style="color: #111827;">✨ What's Next?</h3>
        <div class="info-list">
          <ul>
            <li><span class="checkmark">✓</span> Your channel is now being monitored for trading signals</li>
            <li><span class="checkmark">✓</span> Subscribe to this channel in your dashboard</li>
            <li><span class="checkmark">✓</span> Signals will be automatically detected and traded</li>
            <li><span class="checkmark">✓</span> You'll receive notifications for all trading activity</li>
          </ul>
        </div>

        <p style="font-size: 16px;">
          Head to your dashboard to subscribe to <strong>${data.channelTitle}</strong> and start receiving signals!
        </p>

        <center>
          <a href="${process.env.APP_URL || process.env.FRONTEND_URL}/channels" class="button">
            📱 View All Channels
          </a>
        </center>
      ` : `
        <h3 style="color: #111827;">🔄 What Can You Do?</h3>
        <div class="info-list">
          <p style="margin-top: 0; font-weight: 600; color: #374151;">You can submit a new request with a different channel. Please ensure the channel:</p>
          <ul>
            <li><span class="cross">✗</span> Is a <strong>legitimate trading signal channel</strong></li>
            <li><span class="cross">✗</span> Provides clear signals with <strong>entry, stop loss, and take profit levels</strong></li>
            <li><span class="cross">✗</span> Has a <strong>verifiable track record</strong></li>
            <li><span class="cross">✗</span> Follows proper signal formatting</li>
            <li><span class="cross">✗</span> Is not a scam or promotional channel</li>
          </ul>
        </div>

        <p style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 6px; color: #1e40af;">
          <strong>💡 Tip:</strong> Review successful channels in our directory to see what we look for in quality signal providers.
        </p>

        <center>
          <a href="${process.env.APP_URL || process.env.FRONTEND_URL}/channels/request" class="button">
            🔄 Submit New Request
          </a>
        </center>
      `}

      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
        <h4 style="margin-top: 0; color: #374151;">📞 Need Help?</h4>
        <p style="margin: 5px 0; color: #6b7280;">
          • Email: <a href="mailto:support@tradingbot.com" style="color: #667eea;">support@tradingbot.com</a><br>
          • Visit our <a href="${process.env.APP_URL || process.env.FRONTEND_URL}/help" style="color: #667eea;">Help Center</a><br>
          • Check the <a href="${process.env.APP_URL || process.env.FRONTEND_URL}/faq" style="color: #667eea;">FAQ</a> for common questions
        </p>
      </div>

      <p style="margin-top: 30px;">
        ${data.approved ? 'Happy trading! 🚀' : 'We appreciate your understanding.'}
      </p>

      <p>
        Best regards,<br>
        <strong>The Trading Bot Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 5px 0;"><strong>Trading Bot</strong></p>
      <p style="margin: 5px 0;">Automated Trading Made Simple</p>
      <p style="margin: 15px 0 5px 0;">© ${new Date().getFullYear()} Trading Bot. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
${data.approved ? 'CHANNEL APPROVED ✅' : 'CHANNEL REQUEST NOT APPROVED ❌'}

Hi ${data.recipientName},

Channel: ${data.channelTitle}

STATUS:
${data.approved 
  ? 'Your channel request has been APPROVED! The channel is now active and monitoring signals.' 
  : 'After review, we are unable to approve your channel request at this time.'}

${!data.approved && data.rejectionReason ? `\nREASON:\n${data.rejectionReason}\n` : ''}

${data.approved ? `
WHAT'S NEXT:
✓ Channel is now being monitored for trading signals
✓ Subscribe to this channel in your dashboard
✓ Signals will be automatically detected and traded
✓ You'll receive notifications for all activity

View Channels: ${process.env.APP_URL || process.env.FRONTEND_URL}/channels
` : `
WHAT YOU CAN DO:
Submit a new request with a different channel. Ensure it:
✗ Is a legitimate trading signal channel
✗ Provides clear signals (entry, SL, TP)
✗ Has a verifiable track record
✗ Follows proper signal formatting

Submit New Request: ${process.env.APP_URL || process.env.FRONTEND_URL}/channels/request
`}

NEED HELP?
Email: support@tradingbot.com
Help Center: ${process.env.APP_URL || process.env.FRONTEND_URL}/help

${data.approved ? 'Happy trading! 🚀' : 'We appreciate your understanding.'}

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};