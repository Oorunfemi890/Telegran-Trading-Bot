// FILE: src/services/ea-bridge.service.ts
// =============================================
// EA Bridge Service - Handles communication between EA and backend
// =============================================

import AppDataSource from '../config/database.config';
import { EAToken, EATokenStatus } from '../database/entities/EAToken.entity';
import { EAHeartbeat, EAConnectionStatus } from '../database/entities/EAHeartbeat.entity';
import { Trade } from '../database/entities/Trade.entity';
import { Position } from '../database/entities/Position.entity';
import { User } from '../database/entities/User.entity';
import { TradeStatus, PositionStatus } from '../types';
import { generateRandomToken } from '../helpers/encryption.helper';
import { getWebSocketServer } from '../websocket/socket.server';

export interface TradeInstruction {
  tradeId: string;
  symbol: string;
  direction: 'buy' | 'sell';
  positions: Array<{
    positionId: string;
    positionNumber: number;
    entryPrice: number;
    lotSize: number;
    stopLoss: number;
    takeProfit: number;
    orderType: 'market' | 'limit';
  }>;
  totalRiskAmount: number;
  createdAt: Date;
}

export interface EAExecutionReport {
  tradeId: string;
  positionId: string;
  success: boolean;
  mtOrderTicket?: string;
  openPrice?: number;
  executionTime?: Date;
  error?: string;
}

export class EABridgeService {
  private eaTokenRepo = AppDataSource.getRepository(EAToken);
  private heartbeatRepo = AppDataSource.getRepository(EAHeartbeat);
  private tradeRepo = AppDataSource.getRepository(Trade);
  private positionRepo = AppDataSource.getRepository(Position);
  private userRepo = AppDataSource.getRepository(User);

  /**
   * Generate new EA token for user
   */
  async generateToken(
    userId: string,
    deviceName: string,
    platform?: string
  ): Promise<EAToken> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Revoke existing active tokens for this device
    const existingTokens = await this.eaTokenRepo.find({
      where: {
        user_id: userId,
        deviceName,
        status: EATokenStatus.ACTIVE,
      },
    });

    for (const token of existingTokens) {
      token.revoke();
      await this.eaTokenRepo.save(token);
    }

    // Generate new token
    const tokenString = generateRandomToken(64);

    const eaToken = this.eaTokenRepo.create({
      user_id: userId,
      token: tokenString,
      deviceName,
      platform: platform || null,
      status: EATokenStatus.ACTIVE,
      expiresAt: null, // Never expires unless revoked
      requestCount: 0,
    });

    await this.eaTokenRepo.save(eaToken);

    console.log(`✅ EA Token generated for user ${user.email}: ${deviceName}`);

    return eaToken;
  }

  /**
   * Verify EA token
   */
  async verifyToken(token: string): Promise<{ valid: boolean; userId?: string; tokenId?: string }> {
    const eaToken = await this.eaTokenRepo.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!eaToken) {
      return { valid: false };
    }

    if (!eaToken.isActive()) {
      return { valid: false };
    }

    // Update last used
    eaToken.updateLastUsed();
    await this.eaTokenRepo.save(eaToken);

    return {
      valid: true,
      userId: eaToken.user_id,
      tokenId: eaToken.id,
    };
  }

  /**
   * Get pending trade instructions for EA
   */
  async getInstructions(userId: string): Promise<TradeInstruction[]> {
    const pendingTrades = await this.tradeRepo.find({
      where: {
        user_id: userId,
        status: TradeStatus.PENDING,
      },
      relations: ['positions'],
      order: { createdAt: 'ASC' },
      take: 10, // Max 10 trades at once
    });

    const instructions: TradeInstruction[] = [];

    for (const trade of pendingTrades) {
      const pendingPositions = trade.positions.filter(
        (p) => p.status === PositionStatus.PENDING || p.status === PositionStatus.OPEN
      );

      if (pendingPositions.length > 0) {
        instructions.push({
          tradeId: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          positions: pendingPositions.map((p) => ({
            positionId: p.id,
            positionNumber: p.positionNumber,
            entryPrice: p.entryPrice,
            lotSize: p.lotSize,
            stopLoss: p.currentStopLoss,
            takeProfit: p.currentTakeProfit,
            orderType: p.orderType,
          })),
          totalRiskAmount: trade.totalRiskAmount,
          createdAt: trade.createdAt,
        });
      }
    }

    return instructions;
  }

  /**
   * Report execution result from EA
   */
  async reportExecution(report: EAExecutionReport): Promise<void> {
    const position = await this.positionRepo.findOne({
      where: { id: report.positionId },
      relations: ['trade'],
    });

    if (!position) {
      throw new Error('Position not found');
    }

    if (report.success) {
      // Update position with MT ticket
      position.mtOrderTicket = report.mtOrderTicket || null;
      position.status = PositionStatus.OPEN;
      position.openedAt = report.executionTime || new Date();

      if (report.openPrice) {
        position.entryPrice = report.openPrice;
      }

      await this.positionRepo.save(position);

      // Update trade
      const trade = position.trade;
      trade.positionsFilled += 1;

      // If all positions filled, mark trade as OPEN
      if (trade.positionsFilled >= trade.totalPositions) {
        trade.status = TradeStatus.OPEN;
        trade.openedAt = new Date();
      }

      await this.tradeRepo.save(trade);

      console.log(`✅ EA executed position ${position.positionNumber} for trade ${trade.id}`);

      // Emit WebSocket event
      const wsServer = getWebSocketServer();
      if (wsServer) {
        wsServer.emitPositionUpdate(trade.user_id, {
          tradeId: trade.id,
          positionId: position.id,
          positionNumber: position.positionNumber,
          status: position.status,
          mtOrderTicket: position.mtOrderTicket,
          openedAt: position.openedAt,
        });
      }
    } else {
      console.error(`❌ EA failed to execute position ${position.id}: ${report.error}`);
      // Keep as PENDING for retry
    }
  }

  /**
   * Record EA heartbeat (ping)
   */
  async recordHeartbeat(
    userId: string,
    tokenId: string,
    accountData?: {
      accountNumber?: string;
      broker?: string;
      balance?: number;
      equity?: number;
      freeMargin?: number;
      openPositions?: number;
    },
    ipAddress?: string,
    systemInfo?: any
  ): Promise<void> {
    let heartbeat = await this.heartbeatRepo.findOne({
      where: { user_id: userId, ea_token_id: tokenId },
    });

    if (!heartbeat) {
      heartbeat = this.heartbeatRepo.create({
        user_id: userId,
        ea_token_id: tokenId,
        status: EAConnectionStatus.ONLINE,
        lastPingAt: new Date(),
        balance: accountData?.balance || 0,
        equity: accountData?.equity || 0,
        freeMargin: accountData?.freeMargin || 0,
        openPositions: accountData?.openPositions || 0,
        ipAddress: ipAddress || null,
        systemInfo: systemInfo || null,
      });
    } else {
      heartbeat.updatePing(accountData);
      if (ipAddress) heartbeat.ipAddress = ipAddress;
      if (systemInfo) heartbeat.systemInfo = systemInfo;
    }

    await this.heartbeatRepo.save(heartbeat);

    // Emit WebSocket event
    const wsServer = getWebSocketServer();
    if (wsServer && wsServer.isUserConnected(userId)) {
      wsServer.emitToUser(userId, 'ea:status', {
        status: 'online',
        balance: accountData?.balance,
        equity: accountData?.equity,
        openPositions: accountData?.openPositions,
        lastPing: new Date(),
      });
    }
  }

  /**
   * Get EA connection status for user
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    lastPing: Date | null;
    accountInfo: any;
  }> {
    const heartbeat = await this.heartbeatRepo.findOne({
      where: { user_id: userId },
      order: { lastPingAt: 'DESC' },
    });

    if (!heartbeat) {
      return {
        connected: false,
        lastPing: null,
        accountInfo: null,
      };
    }

    return {
      connected: heartbeat.isOnline(),
      lastPing: heartbeat.lastPingAt,
      accountInfo: {
        accountNumber: heartbeat.accountNumber,
        broker: heartbeat.broker,
        balance: heartbeat.balance,
        equity: heartbeat.equity,
        freeMargin: heartbeat.freeMargin,
        openPositions: heartbeat.openPositions,
      },
    };
  }

  /**
   * Revoke EA token
   */
  async revokeToken(userId: string, tokenId: string): Promise<void> {
    const token = await this.eaTokenRepo.findOne({
      where: { id: tokenId, user_id: userId },
    });

    if (!token) {
      throw new Error('Token not found');
    }

    token.revoke();
    await this.eaTokenRepo.save(token);

    console.log(`✅ EA Token revoked: ${tokenId}`);
  }

  /**
   * Get all user tokens
   */
  async getUserTokens(userId: string): Promise<EAToken[]> {
    return await this.eaTokenRepo.find({
      where: { user_id: userId },
      order: { createdAt: 'DESC' },
    });
  }
}