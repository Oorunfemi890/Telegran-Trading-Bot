// =============================================
// USER & AUTHENTICATION TYPES
// =============================================

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired'
}

export enum SubscriptionTier {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// =============================================
// TRADING TYPES
// =============================================

export enum TradeDirection {
  BUY = 'buy',
  SELL = 'sell'
}

export enum TradeStatus {
  PENDING = 'pending',
  OPEN = 'open',
  CLOSED = 'closed',
  CANCELLED = 'cancelled'
}

export enum PositionStatus {
  PENDING = 'pending',
  OPEN = 'open',
  CLOSED = 'closed'
}

export enum CloseReason {
  TP1 = 'tp1',
  TP2 = 'tp2',
  TP3 = 'tp3',
  SL = 'sl',
  BREAKEVEN_SL = 'breakeven_sl',
  MANUAL = 'manual',
  EXPIRED = 'expired'
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP = 'stop',
  STOP_LIMIT = 'stop_limit'
}

// =============================================
// SIGNAL TYPES
// =============================================

export enum SignalStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  INVALIDATED = 'invalidated',
  COMPLETED = 'completed'
}

export interface ParsedSignal {
  symbol: string;
  direction: TradeDirection;
  entryMin: number;
  entryMax: number;
  stopLoss: number;
  takeProfits: TakeProfitLevel[];
}

export interface TakeProfitLevel {
  level: number;
  price: number;
  positions?: number;
}

export interface EntryPrice {
  position: number;
  price: number;
}

// =============================================
// RISK MANAGEMENT TYPES
// =============================================

export interface RiskParameters {
  accountBalance: number;
  riskPercentage: number;
  positionsPerTrade: number;
  stopLossPips: number;
  lotSize: number;
  totalRiskAmount: number;
  riskPerPosition: number;
}

export interface SymbolSpecification {
  symbol: string;
  pipSize: number;
  pipValue: number;
  contractSize: number;
  minLotSize: number;
  maxLotSize: number;
  lotStep: number;
  marginRequired: number;
}

export enum RiskEventType {
  LOT_SIZE_CALCULATED = 'lot_size_calculated',
  RISK_VALIDATION_PASSED = 'risk_validation_passed',
  RISK_VALIDATION_FAILED = 'risk_validation_failed',
  MARGIN_CHECK_PASSED = 'margin_check_passed',
  MARGIN_CHECK_FAILED = 'margin_check_failed',
  DAILY_LOSS_LIMIT_REACHED = 'daily_loss_limit_reached',
  TRADE_REJECTED = 'trade_rejected'
}

export enum RiskEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// =============================================
// QUEUE JOB TYPES
// =============================================

export enum QueueName {
  SIGNAL_PROCESSING = 'signal-processing',
  TRADE_EXECUTION = 'trade-execution',
  POSITION_MONITORING = 'position-monitoring',
  EMAIL_DELIVERY = 'email-delivery',
  REPORT_GENERATION = 'report-generation'
}

export enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4
}

export interface SignalProcessingJob {
  channelId: string;
  messageId: string;
  messageText: string;
  timestamp: Date;
}

export interface TradeExecutionJob {
  userId: string;
  signalId: string;
  priority: JobPriority;
}

export interface PositionMonitoringJob {
  tradeId: string;
  userId: string;
  checkBreakeven: boolean;
  checkTakeProfit: boolean;
  checkStopLoss: boolean;
}

export interface EmailDeliveryJob {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  priority: JobPriority;
}

export interface ReportGenerationJob {
  userId: string;
  reportDate: Date;
  reportType: 'daily' | 'weekly' | 'monthly';
}

// =============================================
// EMAIL NOTIFICATION TYPES
// =============================================

export enum EmailNotificationType {
  SIGNAL_DETECTED = 'signal_detected',
  TRADE_OPENED = 'trade_opened',
  POSITIONS_FILLED = 'positions_filled',
  BREAKEVEN_ACTIVATED = 'breakeven_activated',
  TAKE_PROFIT_HIT = 'take_profit_hit',
  STOP_LOSS_HIT = 'stop_loss_hit',
  TRADE_COMPLETED = 'trade_completed',
  DAILY_REPORT = 'daily_report',
  ERROR_NOTIFICATION = 'error_notification',
  INVITATION_CODE = 'invitation_code',
  WELCOME = 'welcome'
}

export enum EmailDeliveryStatus {
  QUEUED = 'queued',
  SENT = 'sent',
  FAILED = 'failed',
  BOUNCED = 'bounced'
}

// =============================================
// INVITATION CODE TYPES
// =============================================

export enum InvitationCodeStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

export interface InvitationCodeDetails {
  code: string;
  tier: SubscriptionTier;
  price: number;
  maxUses: number;
  currentUses: number;
  expiresAt: Date;
  status: InvitationCodeStatus;
}

// =============================================
// METATRADER API TYPES
// =============================================

export interface MTAccountInfo {
  accountNumber: string;
  broker: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  leverage: number;
}

export interface MTOrderRequest {
  symbol: string;
  orderType: OrderType;
  volume: number;
  price?: number;
  stopLoss: number;
  takeProfit: number;
  comment?: string;
  magicNumber?: number;
}

export interface MTOrderResponse {
  ticket: number;
  symbol: string;
  orderType: OrderType;
  openPrice: number;
  volume: number;
  stopLoss: number;
  takeProfit: number;
  openTime: Date;
  comment?: string;
}

export interface MTPositionInfo {
  ticket: number;
  symbol: string;
  type: 'buy' | 'sell';
  volume: number;
  openPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  profit: number;
  swap: number;
  commission: number;
}

// =============================================
// API RESPONSE TYPES
// =============================================

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// =============================================
// SYSTEM METRICS TYPES
// =============================================

export interface SystemMetrics {
  totalUsers: number;
  activeUsers: number;
  totalTrades: number;
  activeTrades: number;
  totalSignalsProcessed: number;
  totalProfit: number;
  averageWinRate: number;
  systemUptime: number;
  queueHealth: {
    signalQueue: number;
    executionQueue: number;
    monitoringQueue: number;
    emailQueue: number;
  };
}

export interface UserStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  averageTradeDuration: number;
  returnOnRisk: number;
}

// =============================================
// AUDIT LOG TYPES
// =============================================

export enum AuditAction {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_CREATED = 'user_created',
  USER_UPDATED = 'user_updated',
  USER_DELETED = 'user_deleted',
  INVITATION_GENERATED = 'invitation_generated',
  INVITATION_USED = 'invitation_used',
  SETTINGS_UPDATED = 'settings_updated',
  TRADE_OPENED = 'trade_opened',
  TRADE_CLOSED = 'trade_closed',
  CHANNEL_SUBSCRIBED = 'channel_subscribed',
  CHANNEL_UNSUBSCRIBED = 'channel_unsubscribed',
  ADMIN_ACTION = 'admin_action'
}

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}