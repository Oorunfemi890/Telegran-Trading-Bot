// FILE: src/controllers/signal.controller.ts
// =============================================
// SIGNAL CONTROLLER - NEW FILE
// =============================================

import { Request, Response } from 'express';
import AppDataSource from '../config/database.config';
import { Signal } from '../database/entities/Signal.entity';
import { UserChannelSubscription } from '../database/entities/UserChannelSubscription.entity';
import { SignalStatus } from '../types';

export class SignalController {
  private signalRepo = AppDataSource.getRepository(Signal);
  private subscriptionRepo = AppDataSource.getRepository(UserChannelSubscription);

  /**
   * Get user's signals (from subscribed channels only)
   * GET /api/v1/signals
   */
  async getUserSignals(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as SignalStatus | undefined;
      const symbol = req.query.symbol as string | undefined;
      const direction = req.query.direction as string | undefined;

      // Get user's subscribed channels
      const subscriptions = await this.subscriptionRepo.find({
        where: { user_id: req.userId, isActive: true },
        select: ['channel_id'],
      });

      const subscribedChannelIds = subscriptions.map(s => s.channel_id);

      if (subscribedChannelIds.length === 0) {
        res.status(200).json({
          success: true,
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            pages: 0,
          },
        });
        return;
      }

      // Build query
      const query = this.signalRepo
        .createQueryBuilder('signal')
        .leftJoinAndSelect('signal.channel', 'channel')
        .where('signal.channel_id IN (:...channelIds)', { channelIds: subscribedChannelIds })
        .orderBy('signal.signalTime', 'DESC');

      // Apply filters
      if (status) {
        query.andWhere('signal.status = :status', { status });
      }

      if (symbol) {
        query.andWhere('signal.symbol = :symbol', { symbol });
      }

      if (direction) {
        query.andWhere('signal.direction = :direction', { direction });
      }

      // Get total count
      const total = await query.getCount();

      // Apply pagination
      query.skip((page - 1) * limit).take(limit);

      const signals = await query.getMany();

      res.status(200).json({
        success: true,
        data: signals,
        meta: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      console.error('Get user signals error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch signals',
      });
    }
  }

  /**
   * Get single signal by ID
   * GET /api/v1/signals/:id
   */
  async getSignalById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const { id } = req.params;

      const signal = await this.signalRepo.findOne({
        where: { id },
        relations: ['channel'],
      });

      if (!signal) {
        res.status(404).json({
          success: false,
          message: 'Signal not found',
        });
        return;
      }

      // Verify user is subscribed to this channel
      const subscription = await this.subscriptionRepo.findOne({
        where: {
          user_id: req.userId,
          channel_id: signal.channel_id,
          isActive: true,
        },
      });

      if (!subscription) {
        res.status(403).json({
          success: false,
          message: 'You are not subscribed to this channel',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: signal,
      });
    } catch (error: any) {
      console.error('Get signal by ID error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch signal',
      });
    }
  }
}