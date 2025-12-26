// FILE: src/templates/takeprofit-hit.template.ts
// =============================================

export interface TakeProfitHitData {
  userName: string;
  symbol: string;
  direction: string;
  tpLevel: number;
  tpPrice: number;
  positionsClosed: number;
  positionsRemaining: number;
  profitFromTP: number;
  totalProfit: number;
  tradeId: string;
}

export const generateTakeProfitHitEmail = (data: TakeProfitHitData): { subject: string; html: string; text: string } => {
  const subject = `💰 TP${data.tpLevel} Hit: ${data.symbol} +$${data.profitFromTP.toFixed(2)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .profit-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: center; }
    .profit-amount { font-size: 36px; font-weight: bold; color: #4caf50; margin: 10px 0; }
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
      <h1>💰 Take Profit ${data.tpLevel} Hit!</h1>
      <p style="margin: 10px 0 0 0;">Profit locked in successfully</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.userName},</p>
      
      <div class="profit-box">
        <h3 style="margin-top: 0;">Profit From TP${data.tpLevel}</h3>
        <div class="profit-amount">+$${data.profitFromTP.toFixed(2)}</div>
        <p style="margin-bottom: 0; color: #666;">Locked and secured ✓</p>
      </div>
      
      <p>Congratulations! Your <strong>${data.symbol}</strong> ${data.direction.toUpperCase()} trade has reached Take Profit level ${data.tpLevel}.</p>
      
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
          <span class="detail-label">TP Level:</span>
          <span class="detail-value">TP${data.tpLevel} @ ${data.tpPrice.toFixed(5)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Positions Closed:</span>
          <span class="detail-value">${data.positionsClosed}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Positions Remaining:</span>
          <span class="detail-value">${data.positionsRemaining}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Trade Profit:</span>
          <span class="detail-value" style="color: #4caf50;">+$${data.totalProfit.toFixed(2)}</span>
        </div>
      </div>
      
      ${data.positionsRemaining > 0 ? `
      <p style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; border-radius: 4px;">
        <strong>📊 Remaining Positions:</strong> ${data.positionsRemaining} position(s) still running towards next targets.
      </p>
      ` : `
      <p style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px;">
        <strong>✓ Trade Complete:</strong> All positions have been closed. Final profit locked in!
      </p>
      `}
      
      <p><strong>Trade ID:</strong> <code>${data.tradeId}</code></p>
      
      <p style="margin-top: 30px;">
        ${data.positionsRemaining > 0 ? 'Let the remaining positions run! 🚀' : 'Excellent trade! 🎉'}
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
Take Profit ${data.tpLevel} Hit!

Hi ${data.userName},

Congratulations! Your ${data.symbol} ${data.direction.toUpperCase()} trade reached TP${data.tpLevel}.

Profit Details:
- TP Level: TP${data.tpLevel} @ ${data.tpPrice.toFixed(5)}
- Profit from TP${data.tpLevel}: +$${data.profitFromTP.toFixed(2)}
- Positions Closed: ${data.positionsClosed}
- Positions Remaining: ${data.positionsRemaining}
- Total Trade Profit: +$${data.totalProfit.toFixed(2)}

${data.positionsRemaining > 0 ? 'Remaining positions still running towards next targets.' : 'All positions closed. Trade complete!'}

Trade ID: ${data.tradeId}

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};