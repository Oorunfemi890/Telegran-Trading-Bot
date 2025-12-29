// FILE: src/templates/daily-report.template.ts
// =============================================
// PHASE 10: DAILY REPORT EMAIL TEMPLATE
// =============================================

export interface DailyReportData {
  userName: string;
  reportDate: string;
  tradingStats: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    breakevenTrades: number;
    winRate: number;
  };
  financialStats: {
    startBalance: number;
    endBalance: number;
    netChange: number;
    percentageChange: number;
    grossProfit: number;
    grossLoss: number;
    netProfit: number;
    largestWin: number;
    largestLoss: number;
    averageWin: number;
    averageLoss: number;
  };
  performanceMetrics: {
    profitFactor: number;
    expectancy: number;
    riskRewardRatio: number;
    returnOnRisk: number;
  };
  riskMetrics: {
    breakevenActivations: number;
    breakevenSaved: number;
    tp1Achievements: number;
    tp2Achievements: number;
    tp3Achievements: number;
  };
  insights: string[];
  recommendations: string[];
}

export const generateDailyReportEmail = (data: DailyReportData): { subject: string; html: string; text: string } => {
  const isProfit = data.financialStats.netProfit > 0;
  const subject = `📊 Daily Report: ${data.reportDate} | ${isProfit ? '+' : ''}$${Math.abs(data.financialStats.netProfit).toFixed(2)}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .summary-card { background: ${isProfit ? '#e8f5e9' : data.financialStats.netProfit < 0 ? '#fff3cd' : '#e3f2fd'}; border-left: 4px solid ${isProfit ? '#4caf50' : data.financialStats.netProfit < 0 ? '#ffc107' : '#2196F3'}; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .big-number { font-size: 42px; font-weight: bold; color: ${isProfit ? '#4caf50' : data.financialStats.netProfit < 0 ? '#f57c00' : '#2196F3'}; margin: 10px 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .stat-box { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .stat-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 5px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #333; }
    .section { margin: 25px 0; }
    .section-title { font-size: 20px; font-weight: bold; color: #667eea; margin-bottom: 15px; display: flex; align-items: center; }
    .metric-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e0e0e0; }
    .metric-label { font-weight: 600; color: #666; }
    .metric-value { font-weight: 700; color: #333; }
    .insight-box { background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .recommendation-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
    .progress-bar { background: #e0e0e0; border-radius: 10px; height: 20px; margin: 10px 0; overflow: hidden; }
    .progress-fill { background: ${isProfit ? '#4caf50' : '#f44336'}; height: 100%; transition: width 0.3s ease; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Daily Trading Report</h1>
      <p style="margin: 10px 0 0 0; font-size: 18px;">${data.reportDate}</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.userName},</p>
      
      <p>Here's your complete trading performance summary for today.</p>
      
      <!-- DAILY SUMMARY -->
      <div class="summary-card">
        <h3 style="margin-top: 0; text-align: center;">Today's Result</h3>
        <div class="big-number" style="text-align: center;">
          ${isProfit ? '+' : data.financialStats.netProfit < 0 ? '-' : ''}$${Math.abs(data.financialStats.netProfit).toFixed(2)}
        </div>
        <div style="text-align: center; color: #666; font-size: 16px;">
          ${data.financialStats.percentageChange >= 0 ? '+' : ''}${data.financialStats.percentageChange.toFixed(2)}% 
          | ${data.tradingStats.totalTrades} trade${data.tradingStats.totalTrades !== 1 ? 's' : ''}
        </div>
      </div>
      
      <!-- TRADING STATS GRID -->
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">Win Rate</div>
          <div class="stat-value" style="color: ${data.tradingStats.winRate >= 60 ? '#4caf50' : data.tradingStats.winRate >= 40 ? '#ff9800' : '#f44336'};">
            ${data.tradingStats.winRate.toFixed(1)}%
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Profit Factor</div>
          <div class="stat-value" style="color: ${data.performanceMetrics.profitFactor >= 2 ? '#4caf50' : data.performanceMetrics.profitFactor >= 1 ? '#ff9800' : '#f44336'};">
            ${data.performanceMetrics.profitFactor.toFixed(2)}
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Trades</div>
          <div class="stat-value">${data.tradingStats.totalTrades}</div>
          <div style="font-size: 12px; color: #666; margin-top: 5px;">
            ${data.tradingStats.winningTrades}W ${data.tradingStats.losingTrades}L ${data.tradingStats.breakevenTrades}BE
          </div>
        </div>
        <div class="stat-box">
          <div class="stat-label">Expectancy</div>
          <div class="stat-value" style="color: ${data.performanceMetrics.expectancy > 0 ? '#4caf50' : '#f44336'};">
            $${data.performanceMetrics.expectancy.toFixed(2)}
          </div>
        </div>
      </div>
      
      <!-- FINANCIAL PERFORMANCE -->
      <div class="section">
        <div class="section-title">💰 Financial Performance</div>
        
        <div class="metric-row">
          <span class="metric-label">Starting Balance</span>
          <span class="metric-value">$${data.financialStats.startBalance.toFixed(2)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Ending Balance</span>
          <span class="metric-value">$${data.financialStats.endBalance.toFixed(2)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Gross Profit</span>
          <span class="metric-value" style="color: #4caf50;">+$${data.financialStats.grossProfit.toFixed(2)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Gross Loss</span>
          <span class="metric-value" style="color: #f44336;">-$${data.financialStats.grossLoss.toFixed(2)}</span>
        </div>
        <div class="metric-row" style="background: #f5f5f5; font-size: 16px;">
          <span class="metric-label">Net Profit</span>
          <span class="metric-value" style="color: ${isProfit ? '#4caf50' : '#f44336'};">
            ${isProfit ? '+' : ''}$${data.financialStats.netProfit.toFixed(2)}
          </span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Largest Win</span>
          <span class="metric-value" style="color: #4caf50;">+$${data.financialStats.largestWin.toFixed(2)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Largest Loss</span>
          <span class="metric-value" style="color: #f44336;">-$${data.financialStats.largestLoss.toFixed(2)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Average Win</span>
          <span class="metric-value">$${data.financialStats.averageWin.toFixed(2)}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Average Loss</span>
          <span class="metric-value">$${data.financialStats.averageLoss.toFixed(2)}</span>
        </div>
      </div>
      
      <!-- RISK MANAGEMENT -->
      <div class="section">
        <div class="section-title">🛡️ Risk Management</div>
        
        <div class="metric-row">
          <span class="metric-label">Breakeven Activations</span>
          <span class="metric-value">${data.riskMetrics.breakevenActivations}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Losses Prevented by Breakeven</span>
          <span class="metric-value" style="color: #4caf50;">${data.riskMetrics.breakevenSaved}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">TP1 Achievements</span>
          <span class="metric-value">${data.riskMetrics.tp1Achievements}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">TP2 Achievements</span>
          <span class="metric-value">${data.riskMetrics.tp2Achievements}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">TP3 Achievements</span>
          <span class="metric-value">${data.riskMetrics.tp3Achievements}</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Return on Risk</span>
          <span class="metric-value" style="color: ${data.performanceMetrics.returnOnRisk > 0 ? '#4caf50' : '#f44336'};">
            ${data.performanceMetrics.returnOnRisk.toFixed(2)}%
          </span>
        </div>
      </div>
      
      <!-- INSIGHTS -->
      ${data.insights.length > 0 ? `
      <div class="section">
        <div class="section-title">💡 Key Insights</div>
        ${data.insights.map(insight => `
          <div class="insight-box">
            <strong>✓</strong> ${insight}
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <!-- RECOMMENDATIONS -->
      ${data.recommendations.length > 0 ? `
      <div class="section">
        <div class="section-title">📈 Recommendations</div>
        ${data.recommendations.map(rec => `
          <div class="recommendation-box">
            <strong>→</strong> ${rec}
          </div>
        `).join('')}
      </div>
      ` : ''}
      
      <p style="margin-top: 30px;">
        ${isProfit ? 'Excellent work today! Keep following your strategy! 🎉' : data.financialStats.netProfit < 0 ? 'Stay disciplined and remember: not every day is green. 💪' : 'Breakeven days are wins too - capital preserved! 🛡️'}
      </p>
      
      <p>
        Best regards,<br>
        <strong>The Trading Bot Team</strong>
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} Trading Bot. All rights reserved.</p>
      <p style="font-size: 12px; margin: 10px 0;">
        View detailed analytics in your dashboard
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
DAILY TRADING REPORT
${data.reportDate}

Hi ${data.userName},

Today's Result: ${isProfit ? '+' : data.financialStats.netProfit < 0 ? '-' : ''}$${Math.abs(data.financialStats.netProfit).toFixed(2)}
Change: ${data.financialStats.percentageChange >= 0 ? '+' : ''}${data.financialStats.percentageChange.toFixed(2)}%
Total Trades: ${data.tradingStats.totalTrades}

TRADING STATS:
- Win Rate: ${data.tradingStats.winRate.toFixed(1)}%
- Winning Trades: ${data.tradingStats.winningTrades}
- Losing Trades: ${data.tradingStats.losingTrades}
- Breakeven Trades: ${data.tradingStats.breakevenTrades}

FINANCIAL PERFORMANCE:
- Starting Balance: $${data.financialStats.startBalance.toFixed(2)}
- Ending Balance: $${data.financialStats.endBalance.toFixed(2)}
- Gross Profit: +$${data.financialStats.grossProfit.toFixed(2)}
- Gross Loss: -$${data.financialStats.grossLoss.toFixed(2)}
- Net Profit: ${isProfit ? '+' : ''}$${data.financialStats.netProfit.toFixed(2)}
- Largest Win: +$${data.financialStats.largestWin.toFixed(2)}
- Largest Loss: -$${data.financialStats.largestLoss.toFixed(2)}

PERFORMANCE METRICS:
- Profit Factor: ${data.performanceMetrics.profitFactor.toFixed(2)}
- Expectancy: $${data.performanceMetrics.expectancy.toFixed(2)}
- Risk/Reward Ratio: ${data.performanceMetrics.riskRewardRatio.toFixed(2)}
- Return on Risk: ${data.performanceMetrics.returnOnRisk.toFixed(2)}%

RISK MANAGEMENT:
- Breakeven Activations: ${data.riskMetrics.breakevenActivations}
- Losses Prevented: ${data.riskMetrics.breakevenSaved}
- TP1 Hits: ${data.riskMetrics.tp1Achievements}
- TP2 Hits: ${data.riskMetrics.tp2Achievements}
- TP3 Hits: ${data.riskMetrics.tp3Achievements}

${data.insights.length > 0 ? `\nKEY INSIGHTS:\n${data.insights.map(i => `- ${i}`).join('\n')}` : ''}

${data.recommendations.length > 0 ? `\nRECOMMENDATIONS:\n${data.recommendations.map(r => `- ${r}`).join('\n')}` : ''}

Best regards,
The Trading Bot Team
  `;

  return { subject, html, text };
};