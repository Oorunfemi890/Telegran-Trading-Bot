// Placeholder file: index.ts in src/templates
// FILE: src/templates/email.templates.ts
// =============================================
// Re-export all email templates from individual files

export { 
  generateInvitationEmail, 
  InvitationEmailData 
} from './invitation-email.template';

export { 
  generateWelcomeEmail, 
  WelcomeEmailData 
} from './welcome-email.template';

export { 
  generateTradeOpenedEmail, 
  TradeOpenedData 
} from './trade-opened.template';

export { 
  generateBreakevenActivatedEmail, 
  BreakevenActivatedData 
} from './breakeven-activated.template';

export { 
  generateTakeProfitHitEmail, 
  TakeProfitHitData 
} from './takeprofit-hit.template';

export { 
  generateStopLossHitEmail, 
  StopLossHitData 
} from './stoploss-hit.template';

export { 
  generateTradeCompletedEmail, 
  TradeCompletedData 
} from './trade-completed.template';

// Daily report template will be added in Phase 10
// export { generateDailyReportEmail, DailyReportData } from './daily-report.template';