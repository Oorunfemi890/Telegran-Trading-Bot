// FILE: src/controllers/admin/analytics.controller.ts
// =============================================
// PHASE 11: ADMIN ANALYTICS CONTROLLER (COMPLETE)
// =============================================

import { Request, Response } from 'express';
import { AdminAnalyticsService } from '../../services/admin/analytics.service';

const analyticsService = new AdminAnalyticsService();

export class AdminAnalyticsController {
  /**
   * Get comprehensive system analytics
   * GET /api/v1/admin/analytics/system
   */
  async getSystemAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const dateRange = req.query.dateFrom && req.query.dateTo
        ? {
            start: new Date(req.query.dateFrom as string),
            end: new Date(req.query.dateTo as string),
          }
        : undefined;

      const analytics = await analyticsService.getSystemAnalytics(dateRange);

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get performance trends
   * GET /api/v1/admin/analytics/trends
   */
  async getPerformanceTrends(req: Request, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const trends = await analyticsService.getPerformanceTrends(days);

      res.json({
        success: true,
        data: trends,
        meta: { days },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Get real-time dashboard stats
   * GET /api/v1/admin/analytics/dashboard
   */
  async getRealTimeDashboard(req: Request, res: Response): Promise<void> {
    try {
      const stats = await analyticsService.getRealTimeDashboard();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}