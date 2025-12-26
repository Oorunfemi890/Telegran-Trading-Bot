// FILE: src/templates/breakeven-activated.template.ts
// =============================================

export interface BreakevenActivatedData {
  userName: string;
  symbol: string;
  direction: string;
  totalPositions: number;
  currentProfit: number;
  tradeId: string;
  activationPrice: number;
}

export const generateBreakevenActivatedEmail = (data: BreakevenActivatedData): { subject: string; html: string; text: string } => {
  const subject = `🛡️ Breakeven Activated: ${data.symbol} - Risk Eliminated!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .success-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .trade-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
    .detail-label { font-weight: bold; color: #666; }
    .detail-value { color: #333; font-weight: 600; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    ul { margin: 10px 0; padding-left: 20px; }
    li { margin: 8px 0; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ Breakeven Activated!</h1>
      <p style="margin: 10px 0 0 0;">Your trade is now risk-free</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.userName},</p>
      
      <div class="success-box">
        <h3 style="margin-top: 0; color: #4caf50;">✓ Trade Protection Activated</h3>
        <p style="margin-bottom: 0;">All stop losses have been moved to breakeven. Your trade can no longer result in a loss!</p>
      </div>
      
      <p>Your <strong>${data.symbol}</strong> ${data.direction.toUpperCase()} trade has moved into profit and breakeven protection has been automatically activated.</p>
      
      <div class="trade-info">
        <div class="detail-row">
          <span class="detail-label">Symbol:</span>
          <span class="detail-value">${data.symbol}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Direction:</span>
          <span class="detail-value">${data.direction.toUpperCase()}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Positions Protected:</span>
          <span class="detail-value">${data.totalPositions}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Current Profit:</span>
          <span class="detail-value" style="color: #4caf50;">+$${data.currentProfit.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Activation Price:</span>
          <span class="detail-value">${data.activationPrice.toFixed(5)}</span>
        </div>
      </div>
      
      <p><strong>What This Means:</strong></p>
      <ul>
        <li>All positions now have stop losses at their entry prices</li>
        <li>Even if price reverses completely, you'll exit at breakeven (0 profit, 0 loss)</li>
        <li>You can now let the trade run towards take profit targets risk-free</li>
        <li>The worst outcome is now breaking even, not losing money</li>
      </ul>
      
      <div class="warning-box">
        <strong>💡 Pro Tip:</strong> This is one of the most powerful risk management features. You're now trading with the market's money, not yours!
      </div>
      
      <p><strong>Trade ID:</strong> <code>${data.tradeId}</code></p>
      
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
Breakeven Activated!

Hi ${data.userName},

Your ${data.symbol} ${data.direction.toUpperCase()} trade is now risk-free!

Trade Details:
- Symbol: ${data.symbol}
- Direction: ${data.direction.toUpperCase()}
- Positions Protected: ${data.totalPositions}
- Current Profit: +$${data.currentProfit.toFixed(2)}
- Activation Price: ${data.activationPrice.toFixed(5)}

What This Means:
- All stop losses moved to entry prices
- Worst case scenario: breakeven (0 profit, 0 loss)
- You can now let profits run risk-free

Trade ID: ${data.tradeId}

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};