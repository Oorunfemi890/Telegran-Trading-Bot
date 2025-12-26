// FILE: src/templates/trade-opened.template.ts
// =============================================

export interface TradeOpenedData {
  userName: string;
  symbol: string;
  direction: string;
  totalPositions: number;
  lotSize: number;
  stopLoss: number;
  takeProfits: Array<{ level: number; price: number; positions: number }>;
  riskAmount: number;
  entryPrices: Array<{ position: number; price: number }>;
  averageEntry: number;
  tradeId: string;
}

export const generateTradeOpenedEmail = (data: TradeOpenedData): { subject: string; html: string; text: string } => {
  const subject = `🔔 Trade Opened: ${data.symbol} ${data.direction.toUpperCase()}`;

  const entryPricesList = data.entryPrices
    .map(ep => `Position ${ep.position}: ${ep.price}`)
    .join('<br>');

  const takeProfitsList = data.takeProfits
    .map(tp => `TP${tp.level}: ${tp.price} (${tp.positions} positions)`)
    .join('<br>');

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
    .trade-details { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
    .detail-label { font-weight: bold; color: #666; }
    .detail-value { color: #333; font-weight: 600; }
    .badge { display: inline-block; padding: 5px 15px; border-radius: 15px; font-size: 14px; font-weight: bold; }
    .badge-buy { background: #4caf50; color: white; }
    .badge-sell { background: #f44336; color: white; }
    .positions-grid { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    ul { margin: 10px 0; padding-left: 20px; }
    li { margin: 8px 0; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Trade Opened Successfully!</h1>
      <p style="margin: 10px 0 0 0;">All positions placed in the market</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.userName},</p>
      
      <p>Your automated trade has been opened with the following details:</p>
      
      <div class="trade-details">
        <div class="detail-row">
          <span class="detail-label">Symbol:</span>
          <span class="detail-value">${data.symbol}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Direction:</span>
          <span class="badge ${data.direction.toLowerCase() === 'buy' ? 'badge-buy' : 'badge-sell'}">
            ${data.direction.toUpperCase()}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Total Positions:</span>
          <span class="detail-value">${data.totalPositions}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Lot Size (per position):</span>
          <span class="detail-value">${data.lotSize.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Average Entry:</span>
          <span class="detail-value">${data.averageEntry.toFixed(5)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Stop Loss:</span>
          <span class="detail-value">${data.stopLoss.toFixed(5)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Risk Amount:</span>
          <span class="detail-value" style="color: #f44336;">$${data.riskAmount.toFixed(2)}</span>
        </div>
      </div>
      
      <h3>📍 Entry Prices:</h3>
      <div class="positions-grid">
        ${entryPricesList}
      </div>
      
      <h3>🎯 Take Profit Levels:</h3>
      <div class="positions-grid">
        ${takeProfitsList}
      </div>
      
      <p><strong>Trade ID:</strong> <code>${data.tradeId}</code></p>
      
      <p>You'll receive notifications when:</p>
      <ul>
        <li>Breakeven is activated</li>
        <li>Take profit levels are hit</li>
        <li>The trade is fully closed</li>
      </ul>
      
      <p style="margin-top: 30px;">Good luck! 🚀</p>
      
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
Trade Opened Successfully!

Hi ${data.userName},

Trade Details:
- Symbol: ${data.symbol}
- Direction: ${data.direction.toUpperCase()}
- Total Positions: ${data.totalPositions}
- Lot Size: ${data.lotSize.toFixed(2)} per position
- Average Entry: ${data.averageEntry.toFixed(5)}
- Stop Loss: ${data.stopLoss.toFixed(5)}
- Risk Amount: $${data.riskAmount.toFixed(2)}

Entry Prices:
${data.entryPrices.map(ep => `Position ${ep.position}: ${ep.price}`).join('\n')}

Take Profit Levels:
${data.takeProfits.map(tp => `TP${tp.level}: ${tp.price} (${tp.positions} positions)`).join('\n')}

Trade ID: ${data.tradeId}

You'll receive notifications for breakeven activation, take profit hits, and trade closure.

Good luck!

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};