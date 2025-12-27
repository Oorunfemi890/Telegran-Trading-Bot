// FILE: src/services/risk.validation.ts
// =============================================
import AppDataSource from '../config/database.config';
import { RiskEvent } from '../database/entities/RiskEvent.entity';
import { Trade } from '../database/entities/Trade.entity';
import { UserSettings } from '../database/entities/UserSettings.entity';
import { RiskEventType, RiskEventSeverity, TradeStatus } from '../types';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  severity?: RiskEventSeverity;
}

export class RiskValidationService {
  private riskEventRepo = AppDataSource.getRepository(RiskEvent);
  private tradeRepo = AppDataSource.getRepository(Trade);

  /**
   * Validate all risk parameters before opening a trade
   */
  async validateTrade(
    userId: string,
    settings: UserSettings,
    accountBalance: number,
    availableMargin: number,
    calculatedLotSize: number,
    totalRiskAmount: number,
    requiredMargin: number
  ): Promise<ValidationResult> {
    // 1. Validate balance
    const balanceCheck = this.validateBalance(accountBalance, totalRiskAmount);
    if (!balanceCheck.valid) {
      await this.logRiskEvent(userId, null, RiskEventType.RISK_VALIDATION_FAILED, balanceCheck);
      return balanceCheck;
    }

    // 2. Validate lot size
    const lotSizeCheck = this.validateLotSize(calculatedLotSize);
    if (!lotSizeCheck.valid) {
      await this.logRiskEvent(userId, null, RiskEventType.RISK_VALIDATION_FAILED, lotSizeCheck);
      return lotSizeCheck;
    }

    // 3. Validate margin
    const marginCheck = this.validateMargin(availableMargin, requiredMargin);
    if (!marginCheck.valid) {
      await this.logRiskEvent(userId, null, RiskEventType.MARGIN_CHECK_FAILED, marginCheck);
      return marginCheck;
    }

    // 4. Validate concurrent trades
    const concurrentCheck = await this.validateConcurrentTrades(
      userId,
      settings.maxConcurrentTrades
    );
    if (!concurrentCheck.valid) {
      await this.logRiskEvent(userId, null, RiskEventType.TRADE_REJECTED, concurrentCheck);
      return concurrentCheck;
    }

    // 5. Validate daily loss limit (optional)
    const dailyLossCheck = await this.validateDailyLossLimit(userId, accountBalance);
    if (!dailyLossCheck.valid) {
      await this.logRiskEvent(userId, null, RiskEventType.DAILY_LOSS_LIMIT_REACHED, dailyLossCheck);
      return dailyLossCheck;
    }

    // All validations passed
    await this.logRiskEvent(userId, null, RiskEventType.RISK_VALIDATION_PASSED, {
      accountBalance,
      totalRiskAmount,
      lotSize: calculatedLotSize,
      requiredMargin,
      availableMargin,
    });

    return { valid: true };
  }

  /**
   * Validate account balance is sufficient
   */
  private validateBalance(accountBalance: number, riskAmount: number): ValidationResult {
    if (accountBalance <= 0) {
      return {
        valid: false,
        reason: 'Invalid account balance',
        severity: RiskEventSeverity.ERROR,
      };
    }

    if (riskAmount > accountBalance) {
      return {
        valid: false,
        reason: 'Risk amount exceeds account balance',
        severity: RiskEventSeverity.ERROR,
      };
    }

    return { valid: true };
  }

  /**
   * Validate lot size is within bounds
   */
  private validateLotSize(lotSize: number): ValidationResult {
    const MIN_LOT = 0.01;
    const MAX_LOT = parseFloat(process.env.MAX_LOT_SIZE || '100');

    if (lotSize < MIN_LOT) {
      return {
        valid: false,
        reason: `Lot size ${lotSize} below minimum ${MIN_LOT}`,
        severity: RiskEventSeverity.ERROR,
      };
    }

    if (lotSize > MAX_LOT) {
      return {
        valid: false,
        reason: `Lot size ${lotSize} exceeds maximum ${MAX_LOT}`,
        severity: RiskEventSeverity.ERROR,
      };
    }

    return { valid: true };
  }

  /**
   * Validate sufficient margin is available
   */
  private validateMargin(availableMargin: number, requiredMargin: number): ValidationResult {
    const safetyBuffer = 1.1; // 10% safety buffer
    const requiredWithBuffer = requiredMargin * safetyBuffer;

    if (availableMargin < requiredWithBuffer) {
      return {
        valid: false,
        reason: `Insufficient margin. Required: $${requiredWithBuffer.toFixed(2)}, Available: $${availableMargin.toFixed(2)}`,
        severity: RiskEventSeverity.ERROR,
      };
    }

    return { valid: true };
  }

  /**
   * Validate concurrent trades limit
   */
  private async validateConcurrentTrades(
    userId: string,
    maxConcurrent: number
  ): Promise<ValidationResult> {
    const openTrades = await this.tradeRepo.count({
      where: {
        user_id: userId,
        status: TradeStatus.OPEN,
      },
    });

    if (openTrades >= maxConcurrent) {
      return {
        valid: false,
        reason: `Maximum concurrent trades (${maxConcurrent}) reached. Currently open: ${openTrades}`,
        severity: RiskEventSeverity.WARNING,
      };
    }

    return { valid: true };
  }

  /**
   * Validate daily loss limit (20% of account)
   */
  private async validateDailyLossLimit(
    userId: string,
    accountBalance: number
  ): Promise<ValidationResult> {
    const dailyLimitPercent = 20;
    const dailyLossLimit = (accountBalance * dailyLimitPercent) / 100;

    // Get today's trades
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTrades = await this.tradeRepo.find({
      where: {
        user_id: userId,
        status: TradeStatus.CLOSED,
      },
    });

    // Filter trades from today
    const todayClosedTrades = todayTrades.filter(
      trade => trade.closedAt && trade.closedAt >= today
    );

    // Calculate today's losses
    const todayLoss = todayClosedTrades
      .filter(trade => trade.netProfit < 0)
      .reduce((sum, trade) => sum + Math.abs(trade.netProfit), 0);

    if (todayLoss >= dailyLossLimit) {
      return {
        valid: false,
        reason: `Daily loss limit reached. Lost: $${todayLoss.toFixed(2)}, Limit: $${dailyLossLimit.toFixed(2)}`,
        severity: RiskEventSeverity.CRITICAL,
      };
    }

    return { valid: true };
  }

  /**
   * Log risk event
   */
  private async logRiskEvent(
    userId: string,
    tradeId: string | null,
    eventType: RiskEventType,
    eventData: any
  ): Promise<void> {
    try {
      const riskEvent = this.riskEventRepo.create({
        user_id: userId,
        trade_id: tradeId,
        eventType,
        eventData,
        severity: this.getSeverityForEvent(eventType),
      });

      await this.riskEventRepo.save(riskEvent);
    } catch (error) {
      console.error('❌ Failed to log risk event:', error);
    }
  }

  /**
   * Get severity for event type
   */
  private getSeverityForEvent(eventType: RiskEventType): RiskEventSeverity {
    switch (eventType) {
      case RiskEventType.RISK_VALIDATION_PASSED:
      case RiskEventType.LOT_SIZE_CALCULATED:
      case RiskEventType.MARGIN_CHECK_PASSED:
        return RiskEventSeverity.INFO;

      case RiskEventType.TRADE_REJECTED:
        return RiskEventSeverity.WARNING;

      case RiskEventType.RISK_VALIDATION_FAILED:
      case RiskEventType.MARGIN_CHECK_FAILED:
        return RiskEventSeverity.ERROR;

      case RiskEventType.DAILY_LOSS_LIMIT_REACHED:
        return RiskEventSeverity.CRITICAL;

      default:
        return RiskEventSeverity.INFO;
    }
  }
}