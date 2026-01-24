// FILE: src/controllers/ea-bridge.controller.ts (UPDATED)
// =============================================
// EA Bridge Controller - WITH NEW ENDPOINTS
// =============================================

import { Request, Response } from 'express';
import { EABridgeService } from '../services/ea-bridge.service';

const eaBridgeService = new EABridgeService();

export class EABridgeController {
  /**
   * Generate new EA token
   */
  async generateToken(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { deviceName, platform } = req.body;

      if (!deviceName) {
        res.status(400).json({
          success: false,
          message: 'Device name is required',
        });
        return;
      }

      const token = await eaBridgeService.generateToken(
        req.userId,
        deviceName,
        platform
      );

      res.status(201).json({
        success: true,
        message: 'EA token generated successfully',
        data: {
          token: token.token,
          deviceName: token.deviceName,
          platform: token.platform,
          createdAt: token.createdAt,
          expiresAt: token.expiresAt,
        },
      });
    } catch (error: any) {
      console.error('Generate EA token error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to generate EA token',
      });
    }
  }

  /**
   * Get trade instructions (called by EA)
   */
  async getInstructions(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers['x-ea-token'] as string;

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'EA token required',
        });
        return;
      }

      const verification = await eaBridgeService.verifyToken(token);
      if (!verification.valid || !verification.userId) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired EA token',
        });
        return;
      }

      const instructions = await eaBridgeService.getInstructions(verification.userId);

      res.status(200).json({
        success: true,
        data: {
          instructions,
          count: instructions.length,
        },
      });
    } catch (error: any) {
      console.error('Get instructions error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get instructions',
      });
    }
  }

  /**
   * Report execution result (called by EA)
   */
  async reportExecution(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers['x-ea-token'] as string;

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'EA token required',
        });
        return;
      }

      const verification = await eaBridgeService.verifyToken(token);
      if (!verification.valid) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired EA token',
        });
        return;
      }

      const { tradeId, positionId, success, mtOrderTicket, openPrice, executionTime, error } = req.body;

      if (!tradeId || !positionId || success === undefined) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields',
        });
        return;
      }

      await eaBridgeService.reportExecution({
        tradeId,
        positionId,
        success,
        mtOrderTicket,
        openPrice,
        executionTime: executionTime ? new Date(executionTime) : undefined,
        error,
      });

      res.status(200).json({
        success: true,
        message: 'Execution report received',
      });
    } catch (error: any) {
      console.error('Report execution error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process execution report',
      });
    }
  }

  /**
   * ✅ FIXED: EA heartbeat/ping with better logging
   */
  async ping(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers['x-ea-token'] as string;

      if (!token) {
        res.status(401).json({
          success: false,
          message: 'EA token required',
        });
        return;
      }

      const verification = await eaBridgeService.verifyToken(token);
      if (!verification.valid || !verification.userId || !verification.tokenId) {
        res.status(401).json({
          success: false,
          message: 'Invalid or expired EA token',
        });
        return;
      }

      const { accountNumber, broker, balance, equity, freeMargin, openPositions, systemInfo } = req.body;

      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip;

      await eaBridgeService.recordHeartbeat(
        verification.userId,
        verification.tokenId,
        {
          accountNumber,
          broker,
          balance,
          equity,
          freeMargin,
          openPositions,
        },
        ipAddress,
        systemInfo
      );

      console.log(`✅ EA Ping received from token ${verification.tokenId.substring(0, 8)}...`);

      res.status(200).json({
        success: true,
        message: 'Ping received',
        serverTime: new Date(),
      });
    } catch (error: any) {
      console.error('EA ping error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to process ping',
      });
    }
  }

  /**
   * Get EA connection status (for user dashboard)
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const status = await eaBridgeService.getConnectionStatus(req.userId);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      console.error('Get EA status error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get EA status',
      });
    }
  }

  /**
   * ✅ FIXED: Get all user EA tokens with connection status
   */
  async getTokens(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const tokens = await eaBridgeService.getUserTokens(req.userId, false); // Only active

      // ✅ Add connection status to each token
      const tokensWithStatus = await Promise.all(
        tokens.map(async (t) => {
          const isConnected = await eaBridgeService.getTokenConnectionStatus(t.id);
          
          return {
            id: t.id,
            deviceName: t.deviceName,
            platform: t.platform,
            status: t.status,
            lastUsedAt: t.lastUsedAt,
            createdAt: t.createdAt,
            requestCount: t.requestCount,
            isConnected, // ✅ NEW: Connection status
          };
        })
      );

      res.status(200).json({
        success: true,
        data: tokensWithStatus,
      });
    } catch (error: any) {
      console.error('Get EA tokens error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get EA tokens',
      });
    }
  }

  /**
   * ✅ UPDATED: Revoke EA token (doesn't delete)
   */
  async revokeToken(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { id } = req.params;

      await eaBridgeService.revokeToken(req.userId, id);

      res.status(200).json({
        success: true,
        message: 'EA token revoked successfully',
      });
    } catch (error: any) {
      console.error('Revoke EA token error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to revoke EA token',
      });
    }
  }

  /**
   * ✅ NEW: Reactivate revoked token
   */
  async reactivateToken(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { id } = req.params;

      await eaBridgeService.reactivateToken(req.userId, id);

      res.status(200).json({
        success: true,
        message: 'EA token reactivated successfully',
      });
    } catch (error: any) {
      console.error('Reactivate EA token error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to reactivate EA token',
      });
    }
  }

  /**
   * ✅ NEW: Permanently delete token
   */
  async deleteToken(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { id } = req.params;

      await eaBridgeService.deleteToken(req.userId, id);

      res.status(200).json({
        success: true,
        message: 'EA token deleted permanently',
      });
    } catch (error: any) {
      console.error('Delete EA token error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete EA token',
      });
    }
  }

  /**
   * ✅ NEW: Get connected EAs count (for admin dashboard)
   */
  async getConnectedCount(req: Request, res: Response): Promise<void> {
    try {
      const count = await eaBridgeService.getConnectedEAsCount();

      res.status(200).json({
        success: true,
        data: { count },
      });
    } catch (error: any) {
      console.error('Get connected EAs count error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get connected EAs count',
      });
    }
  }
}