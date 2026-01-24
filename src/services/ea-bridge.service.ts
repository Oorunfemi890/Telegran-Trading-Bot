// FILE: src/services/ea-bridge.service.ts (COMPLETE FIX)
// =============================================
// EA Bridge Service - WITH CONNECTION TRACKING
// =============================================

import AppDataSource from "../config/database.config";
import { EAToken, EATokenStatus } from "../database/entities/EAToken.entity";
import {
  EAHeartbeat,
  EAConnectionStatus,
} from "../database/entities/EAHeartbeat.entity";
import { Trade } from "../database/entities/Trade.entity";
import { Position } from "../database/entities/Position.entity";
import { User } from "../database/entities/User.entity";
import { TradeStatus, PositionStatus } from "../types";
import { generateRandomToken } from "../helpers/encryption.helper";
import { getWebSocketServer } from "../websocket/socket.server";
import { In } from "typeorm";

export interface TradeInstruction {
  tradeId: string;
  symbol: string;
  direction: "buy" | "sell";
  positions: Array<{
    positionId: string;
    positionNumber: number;
    entryPrice: number;
    lotSize: number;
    stopLoss: number;
    takeProfit: number;
    orderType: "market" | "limit";
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

  async generateToken(
    userId: string,
    deviceName: string,
    platform?: string
  ): Promise<EAToken> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    // ✅ DON'T revoke existing tokens - let user manage them
    const tokenString = generateRandomToken(64);

    const eaToken = this.eaTokenRepo.create({
      user_id: userId,
      token: tokenString,
      deviceName,
      platform: platform || null,
      status: EATokenStatus.ACTIVE,
      expiresAt: null,
      requestCount: 0,
    });

    await this.eaTokenRepo.save(eaToken);

    console.log(`✅ EA Token generated for user ${user.email}: ${deviceName}`);

    return eaToken;
  }

  async verifyToken(
    token: string
  ): Promise<{ valid: boolean; userId?: string; tokenId?: string }> {
    const eaToken = await this.eaTokenRepo.findOne({
      where: { token },
      relations: ["user"],
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

  async getInstructions(userId: string): Promise<TradeInstruction[]> {
    const trades = await this.tradeRepo.find({
      where: {
        user_id: userId,
        status: In([TradeStatus.PENDING, TradeStatus.OPEN]),
      },
      relations: ["positions"],
      order: { createdAt: "ASC" },
    });

    const instructions: TradeInstruction[] = [];

    for (const trade of trades) {
      const pendingPositions = trade.positions.filter(
        (p) => p.status === PositionStatus.PENDING
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

    console.log(
      `📤 EA Instructions: ${instructions.length} trade(s) with pending positions`
    );
    return instructions;
  }

  async reportExecution(report: EAExecutionReport): Promise<void> {
    const position = await this.positionRepo.findOne({
      where: { id: report.positionId },
      relations: ["trade", "trade.user"],
    });

    if (!position) {
      throw new Error("Position not found");
    }

    const trade = position.trade;

    if (report.success) {
      position.mtOrderTicket = report.mtOrderTicket || null;
      position.status = PositionStatus.OPEN;
      position.openedAt = report.executionTime || new Date();

      if (report.openPrice) {
        position.entryPrice = report.openPrice;
      }

      await this.positionRepo.save(position);

      trade.positionsFilled += 1;

      if (trade.positionsFilled >= trade.totalPositions) {
        trade.status = TradeStatus.OPEN;
        trade.openedAt = new Date();
      }

      await this.tradeRepo.save(trade);

      console.log(
        `✅ EA executed position ${position.positionNumber} for trade ${trade.id}`
      );

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

        if (
          trade.status === TradeStatus.OPEN &&
          trade.positionsFilled === trade.totalPositions
        ) {
          wsServer.emitTradeOpened(trade.user_id, {
            id: trade.id,
            symbol: trade.symbol,
            direction: trade.direction,
            status: TradeStatus.OPEN,
            openedAt: trade.openedAt,
          });
        }
      }
    } else {
      console.error(
        `❌ EA failed to execute position ${position.id}: ${report.error}`
      );
    }
  }

  /**
   * ✅ FIXED: Record heartbeat and update connection status
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
        accountNumber: accountData?.accountNumber || null,
        broker: accountData?.broker || null,
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

    // ✅ UPDATE TOKEN STATUS TO SHOW IT'S CONNECTED
    const token = await this.eaTokenRepo.findOne({
      where: { id: tokenId },
    });

    if (token) {
      token.lastUsedAt = new Date();
      await this.eaTokenRepo.save(token);
    }

    // ✅ Emit WebSocket event for real-time UI update
    const wsServer = getWebSocketServer();
    if (wsServer && wsServer.isUserConnected(userId)) {
      wsServer.emitToUser(userId, "ea:status", {
        status: "online",
        balance: accountData?.balance,
        equity: accountData?.equity,
        openPositions: accountData?.openPositions,
        lastPing: new Date(),
      });
    }

    console.log(`✅ EA Heartbeat recorded for user ${userId}`);
  }

  /**
   * ✅ FIXED: Get connection status with online check
   */
  async getConnectionStatus(userId: string): Promise<{
    connected: boolean;
    lastPing: Date | null;
    accountInfo: any;
  }> {
    const heartbeat = await this.heartbeatRepo.findOne({
      where: { user_id: userId },
      order: { lastPingAt: "DESC" },
    });

    if (!heartbeat) {
      return {
        connected: false,
        lastPing: null,
        accountInfo: null,
      };
    }

    // ✅ Check if online (last ping within 2 minutes)
    const isOnline = heartbeat.isOnline();

    return {
      connected: isOnline,
      lastPing: heartbeat.lastPingAt,
      accountInfo: isOnline
        ? {
            accountNumber: heartbeat.accountNumber,
            broker: heartbeat.broker,
            balance: heartbeat.balance,
            equity: heartbeat.equity,
            freeMargin: heartbeat.freeMargin,
            openPositions: heartbeat.openPositions,
          }
        : null,
    };
  }

  /**
   * ✅ NEW: Revoke token (mark as revoked, not deleted)
   */
  async revokeToken(userId: string, tokenId: string): Promise<void> {
    const token = await this.eaTokenRepo.findOne({
      where: { id: tokenId, user_id: userId },
    });

    if (!token) {
      throw new Error("Token not found");
    }

    token.revoke();
    await this.eaTokenRepo.save(token);

    console.log(`✅ EA Token revoked: ${tokenId}`);
  }

  /**
   * ✅ NEW: Reactivate token
   */
  async reactivateToken(userId: string, tokenId: string): Promise<void> {
    const token = await this.eaTokenRepo.findOne({
      where: { id: tokenId, user_id: userId },
    });

    if (!token) {
      throw new Error("Token not found");
    }

    if (token.status !== EATokenStatus.REVOKED) {
      throw new Error("Only revoked tokens can be reactivated");
    }

    token.status = EATokenStatus.ACTIVE;
    await this.eaTokenRepo.save(token);

    console.log(`✅ EA Token reactivated: ${tokenId}`);
  }

  /**
   * ✅ NEW: Permanently delete token
   */
  async deleteToken(userId: string, tokenId: string): Promise<void> {
    const token = await this.eaTokenRepo.findOne({
      where: { id: tokenId, user_id: userId },
    });

    if (!token) {
      throw new Error("Token not found");
    }

    // Delete associated heartbeat
    await this.heartbeatRepo.delete({ ea_token_id: tokenId });

    // Delete token
    await this.eaTokenRepo.delete({ id: tokenId });

    console.log(`✅ EA Token deleted permanently: ${tokenId}`);
  }

  /**
   * ✅ FIXED: Get only ACTIVE tokens by default
   */
  async getUserTokens(
    userId: string,
    includeRevoked: boolean = false
  ): Promise<EAToken[]> {
    const whereClause: any = { user_id: userId };

    if (!includeRevoked) {
      whereClause.status = EATokenStatus.ACTIVE;
    }

    return await this.eaTokenRepo.find({
      where: whereClause,
      order: { createdAt: "DESC" },
    });
  }

  /**
   * ✅ NEW: Get connection status for a specific token
   */
  async getTokenConnectionStatus(tokenId: string): Promise<boolean> {
    const heartbeat = await this.heartbeatRepo.findOne({
      where: { ea_token_id: tokenId },
      order: { lastPingAt: "DESC" },
    });

    if (!heartbeat) {
      return false;
    }

    return heartbeat.isOnline();
  }

  /**
   * ✅ NEW: Get all connected EAs count (for admin dashboard)
   */
  async getConnectedEAsCount(): Promise<number> {
    const twoMinutesAgo = new Date();
    twoMinutesAgo.setMinutes(twoMinutesAgo.getMinutes() - 2);

    const count = await this.heartbeatRepo
      .createQueryBuilder("heartbeat")
      .where("heartbeat.lastPingAt > :twoMinutesAgo", { twoMinutesAgo })
      .andWhere("heartbeat.status = :status", {
        status: EAConnectionStatus.ONLINE,
      })
      .getCount();

    return count;
  }
}
