// FILE: src/templates/trade-completed.template.ts
// =============================================

export interface TradeCompletedData {
  userName: string;
  symbol: string;
  direction: string;
  totalPositions: number;
  duration: string;
  netProfit: number;
  returnOnRisk: number;
  averageEntry: number;
  averageExit: number;
  tradeId: string;
  positionBreakdown: Array<{
    position: number;
    entryPrice: number;
    exitPrice: number;
    profit: number;
    closeReason: string;
  }>;
}

export const generateTradeCompletedEmail = (data: TradeCompletedData): { subject: string; html: string; text: string } => {
  const isProfit = data.netProfit > 0;
  const subject = isProfit
    ? `✅ Trade Complete: ${data.symbol} +$${data.netProfit.toFixed(2)}`
    : data.netProfit < 0
    ? `⚠️ Trade Complete: ${data.symbol} -$${Math.abs(data.netProfit).toFixed(2)}`
    : `🔄 Trade Complete: ${data.symbol} (Breakeven)`;

  const positionsHtml = data.positionBreakdown
    .map(p => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${p.position}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${p.entryPrice.toFixed(5)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${p.exitPrice.toFixed(5)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; color: ${p.profit >= 0 ? '#4caf50' : '#f44336'};">
          ${p.profit >= 0 ? '+' : ''}$${p.profit.toFixed(2)}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${p.closeReason}</td>
      </tr>
    `)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: ${isProfit ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : data.netProfit < 0 ? 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)' : 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)'}; color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .profit-box { background: ${isProfit ? '#e8f5e9' : data.netProfit < 0 ? '#fff3cd' : '#e3f2fd'}; border-left: 4px solid ${isProfit ? '#4caf50' : data.netProfit < 0 ? '#ffc107' : '#2196F3'}; padding: 20px; margin: 20px 0; border-radius: 4px; text-align: center; }
    .profit-amount { font-size: 42px; font-weight: bold; color: ${isProfit ? '#4caf50' : data.netProfit < 0 ? '#f57c00' : '#2196F3'}; margin: 10px 0; }
    .trade-info { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
    .detail-label { font-weight: bold; color: #666; }
    .detail-value { color: #333; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background: #f5f5f5; padding: 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #e0e0e0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${isProfit ? '✅' : data.netProfit < 0 ? '⚠️' : '🔄'} Trade Complete!</h1>
      <p style="margin: 10px 0 0 0;">Full trade summary and analysis</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.userName},</p>
      
      <div class="profit-box">
        <h3 style="margin-top: 0;">Final Result</h3>
        <div class="profit-amount">${isProfit ? '+' : data.netProfit < 0 ? '-' : ''}$${Math.abs(data.netProfit).toFixed(2)}</div>
        <p style="margin-bottom: 0; color: #666;">
          ${isProfit ? 'Profitable trade! 🎉' : data.netProfit < 0 ? 'Loss contained by risk management' : 'Breakeven - Capital preserved'}
        </p>
      </div>
      
      <p>Your <strong>${data.symbol}</strong> ${data.direction.toUpperCase()} trade has been fully closed.</p>
      
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
          <span class="detail-label">Total Positions:</span>
          <span class="detail-value">${data.totalPositions}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Trade Duration:</span>
          <span class="detail-value">${data.duration}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Average Entry:</span>
          <span class="detail-value">${data.averageEntry.toFixed(5)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Average Exit:</span>
          <span class="detail-value">${data.averageExit.toFixed(5)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Net Profit:</span>
          <span class="detail-value" style="color: ${isProfit ? '#4caf50' : data.netProfit < 0 ? '#f44336' : '#2196F3'};">
            ${isProfit ? '+' : data.netProfit < 0 ? '-' : ''}$${Math.abs(data.netProfit).toFixed(2)}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Return on Risk:</span>
          <span class="detail-value">${data.returnOnRisk.toFixed(2)}%</span>
        </div>
      </div>
      
      <h3>📊 Position-by-Position Breakdown:</h3>
      <table>
        <tr>
          <th>Position</th>
          <th>Entry</th>
          <th>Exit</th>
          <th>Profit</th>
          <th>Reason</th>
        </tr>
        ${positionsHtml}
      </table>
      
      <p><strong>Trade ID:</strong> <code>${data.tradeId}</code></p>
      
      ${isProfit ? `
      <p style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; border-radius: 4px;">
        <strong>🎯 Great Trade!</strong> Your strategy and risk management worked perfectly. Keep following your plan!
      </p>
      ` : data.netProfit < 0 ? `
      <p style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 4px;">
        <strong>💡 Learning Moment:</strong> Not every trade wins, and that's normal. Your stop loss protected your capital. Stay disciplined and move on to the next opportunity!
      </p>
      ` : `
      <p style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; border-radius: 4px;">
        <strong>🛡️ Breakeven Protection:</strong> Your trade was risk-free and exited without loss. Perfect risk management!
      </p>
      `}
      
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
Trade Complete!

Hi ${data.userName},

Your ${data.symbol} ${data.direction.toUpperCase()} trade has been fully closed.

Final Summary:
- Symbol: ${data.symbol}
- Direction: ${data.direction.toUpperCase()}
- Total Positions: ${data.totalPositions}
- Duration: ${data.duration}
- Average Entry: ${data.averageEntry.toFixed(5)}
- Average Exit: ${data.averageExit.toFixed(5)}
- Net Profit: ${isProfit ? '+' : data.netProfit < 0 ? '-' : ''}$${Math.abs(data.netProfit).toFixed(2)}
- Return on Risk: ${data.returnOnRisk.toFixed(2)}%

Position Breakdown:
${data.positionBreakdown.map(p => 
  `Position ${p.position}: ${p.entryPrice.toFixed(5)} → ${p.exitPrice.toFixed(5)} | ${p.profit >= 0 ? '+' : ''}$${p.profit.toFixed(2)} (${p.closeReason})`
).join('\n')}

Trade ID: ${data.tradeId}

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};