// FILE: src/templates/stoploss-hit.template.ts
// =============================================

export interface StopLossHitData {
  userName: string;
  symbol: string;
  direction: string;
  stopLossType: 'original' | 'breakeven';
  lossAmount: number;
  positionsClosed: number;
  tradeId: string;
  accountBalance: number;
  riskPercentage: number;
}

export const generateStopLossHitEmail = (data: StopLossHitData): { subject: string; html: string; text: string } => {
  const isBreakeven = data.stopLossType === 'breakeven';
  const subject = isBreakeven 
    ? `🔄 Trade Closed at Breakeven: ${data.symbol}`
    : `⚠️ Stop Loss Hit: ${data.symbol} -$${Math.abs(data.lossAmount).toFixed(2)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: ${isBreakeven ? 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)' : 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'}; color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .info-box { background: ${isBreakeven ? '#e3f2fd' : '#fff3cd'}; border-left: 4px solid ${isBreakeven ? '#2196F3' : '#ffc107'}; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .trade-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
    .detail-label { font-weight: bold; color: #666; }
    .detail-value { color: #333; font-weight: 600; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isBreakeven ? '🔄 Trade Closed at Breakeven' : '⚠️ Stop Loss Hit'}</h1>
      <p style="margin: 10px 0 0 0;">${isBreakeven ? 'No profit, no loss' : 'Trade stopped out'}</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.userName},</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0;">${isBreakeven ? '✓ Protected by Breakeven' : 'ℹ️ Risk Management Activated'}</h3>
        <p style="margin-bottom: 0;">
          ${isBreakeven 
            ? 'Your trade hit the breakeven stop loss and exited with zero loss. This is exactly how risk management should work!' 
            : 'Your trade hit the stop loss level. This is normal risk management protecting your capital.'}
        </p>
      </div>
      
      <p>Your <strong>${data.symbol}</strong> ${data.direction.toUpperCase()} trade has been closed.</p>
      
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
          <span class="detail-label">Stop Loss Type:</span>
          <span class="detail-value">${isBreakeven ? 'Breakeven' : 'Original'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Positions Closed:</span>
          <span class="detail-value">${data.positionsClosed}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Result:</span>
          <span class="detail-value" style="color: ${isBreakeven ? '#2196F3' : '#f44336'};">
            ${isBreakeven ? '$0.00 (Breakeven)' : `-$${Math.abs(data.lossAmount).toFixed(2)}`}
          </span>
        </div>
        ${!isBreakeven ? `
        <div class="detail-row">
          <span class="detail-label">Risk Percentage:</span>
          <span class="detail-value">${data.riskPercentage.toFixed(2)}%</span>
        </div>
        ` : ''}
        <div class="detail-row">
          <span class="detail-label">Account Balance:</span>
          <span class="detail-value">$${data.accountBalance.toFixed(2)}</span>
        </div>
      </div>
      
      ${isBreakeven ? `
      <p><strong>Why This Happened:</strong></p>
      <ul>
        <li>Your trade moved into profit and triggered breakeven protection</li>
        <li>Price then reversed and hit the breakeven stop loss</li>
        <li>You exited with exactly 0 profit and 0 loss</li>
        <li>Your capital is fully preserved for the next opportunity</li>
      </ul>
      ` : `
      <p><strong>What This Means:</strong></p>
      <ul>
        <li>The market moved against your position</li>
        <li>Your predefined stop loss protected your account</li>
        <li>This loss was within your acceptable risk parameters</li>
        <li>Your account is still healthy and ready for the next trade</li>
      </ul>
      
      <p style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; border-radius: 4px;">
        <strong>💡 Remember:</strong> Stop losses are your friend. They protect your capital and keep you in the game. Professional traders have losing trades too - it's part of successful trading.
      </p>
      `}
      
      <p><strong>Trade ID:</strong> <code>${data.tradeId}</code></p>
      
      <p style="margin-top: 30px;">
        ${isBreakeven ? 'Great risk management! On to the next one! 💪' : 'Keep your head up! The next opportunity is around the corner! 💪'}
      </p>
      
      <p>
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
${isBreakeven ? 'Trade Closed at Breakeven' : 'Stop Loss Hit'}

Hi ${data.userName},

Your ${data.symbol} ${data.direction.toUpperCase()} trade has been closed.

Trade Details:
- Symbol: ${data.symbol}
- Direction: ${data.direction.toUpperCase()}
- Stop Loss Type: ${isBreakeven ? 'Breakeven' : 'Original'}
- Positions Closed: ${data.positionsClosed}
- Result: ${isBreakeven ? '$0.00 (Breakeven)' : `-$${Math.abs(data.lossAmount).toFixed(2)}`}
${!isBreakeven ? `- Risk Percentage: ${data.riskPercentage.toFixed(2)}%` : ''}
- Account Balance: $${data.accountBalance.toFixed(2)}

${isBreakeven 
  ? 'Your trade was protected by breakeven and exited with no loss. Capital preserved!'
  : 'Your stop loss protected your account. This loss was within your acceptable risk parameters.'}

Trade ID: ${data.tradeId}

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};