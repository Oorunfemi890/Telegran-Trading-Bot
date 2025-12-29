// FILE: src/services/report.generator.ts
// =============================================
// PHASE 10: DAILY REPORT GENERATION SERVICE (UPDATED)
// =============================================

import AppDataSource from "../config/database.config";
import { DailyReport } from "../database/entities/DailyReport.entity";
import { Trade } from "../database/entities/Trade.entity";
import { User } from "../database/entities/User.entity";
import { Signal } from "../database/entities/Signal.entity";
import { TradeStatus } from "../types";
import { Between } from "typeorm";
import { EmailService } from "./email.service";
import { generateDailyReportEmail, DailyReportData } from "../templates/daily-report.template";

export interface ReportStatistics {
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
}

export class ReportGeneratorService {
  private reportRepo = AppDataSource.getRepository(DailyReport);
  private tradeRepo = AppDataSource.getRepository(Trade);
  private userRepo = AppDataSource.getRepository(User);
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Generate daily reports for all active users
   */
  async generateDailyReportsForAllUsers(): Promise<number> {
    console.log("\n📊 GENERATING DAILY REPORTS FOR ALL USERS\n");

    const users = await this.userRepo.find({
      where: { emailVerified: true },
      relations: ["settings"],
    });

    let reportsGenerated = 0;

    for (const user of users) {
      try {
        if (user.settings?.dailyReportEnabled) {
          await this.generateDailyReport(user.id);
          reportsGenerated++;
        }
      } catch (error) {
        console.error(
          `❌ Failed to generate report for user ${user.email}:`,
          error
        );
      }
    }

    console.log(`\n✅ Generated ${reportsGenerated} daily reports\n`);
    return reportsGenerated;
  }

  /**
   * Generate daily report for a single user
   */
  async generateDailyReport(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    console.log(`📊 Generating report for: ${user.fullName}`);

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's closed trades
    const todaysTrades = await this.tradeRepo.find({
      where: {
        user_id: userId,
        status: TradeStatus.CLOSED,
        closedAt: Between(today, tomorrow),
      },
      relations: ["positions", "signal"],
    });

    if (todaysTrades.length === 0) {
      console.log("   ℹ️  No trades closed today - skipping report");
      return;
    }

    // Calculate statistics
    const stats = this.calculateStatistics(todaysTrades);

    // Generate insights
    const insights = this.generateInsights(stats, todaysTrades);

    // Generate recommendations
    const recommendations = this.generateRecommendations(stats, todaysTrades);

    // Save report to database
    const report = this.reportRepo.create({
      user_id: userId,
      reportDate: today,
      tradingStats: stats.tradingStats,
      financialStats: stats.financialStats,
      performanceMetrics: stats.performanceMetrics,
      riskMetrics: stats.riskMetrics,
      signalAnalysis: this.analyzeSignalSources(todaysTrades),
      insights,
      recommendations,
    });

    await this.reportRepo.save(report);
    console.log(`   ✅ Report saved: ${report.id}`);

    // ✅ SEND EMAIL WITH TEMPLATE
    await this.sendDailyReportEmail(user, stats, insights, recommendations, today);
  }

  /**
   * Calculate all statistics
   */
  private calculateStatistics(trades: Trade[]): ReportStatistics {
    const winningTrades = trades.filter((t) => t.netProfit > 0);
    const losingTrades = trades.filter((t) => t.netProfit < 0);
    const breakevenTrades = trades.filter((t) => t.netProfit === 0);

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.netProfit, 0);
    const grossLoss = Math.abs(
      losingTrades.reduce((sum, t) => sum + t.netProfit, 0)
    );
    const netProfit = grossProfit - grossLoss;

    // Calculate account balance (TODO: Get from actual trading account)
    const startBalance = 10000;
    const endBalance = startBalance + netProfit;

    return {
      tradingStats: {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        breakevenTrades: breakevenTrades.length,
        winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
      },
      financialStats: {
        startBalance,
        endBalance,
        netChange: netProfit,
        percentageChange: (netProfit / startBalance) * 100,
        grossProfit,
        grossLoss,
        netProfit,
        largestWin: Math.max(...winningTrades.map((t) => t.netProfit), 0),
        largestLoss: Math.abs(
          Math.min(...losingTrades.map((t) => t.netProfit), 0)
        ),
        averageWin:
          winningTrades.length > 0 ? grossProfit / winningTrades.length : 0,
        averageLoss:
          losingTrades.length > 0 ? grossLoss / losingTrades.length : 0,
      },
      performanceMetrics: {
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit,
        expectancy: trades.length > 0 ? netProfit / trades.length : 0,
        riskRewardRatio:
          losingTrades.length > 0 && winningTrades.length > 0
            ? (grossProfit / winningTrades.length) / (grossLoss / losingTrades.length)
            : 0,
        returnOnRisk:
          trades.length > 0
            ? (netProfit / trades.reduce((sum, t) => sum + t.totalRiskAmount, 0)) * 100
            : 0,
      },
      riskMetrics: {
        breakevenActivations: trades.filter((t) => t.breakevenActivated).length,
        breakevenSaved: this.calculateBreakevenSavings(trades),
        tp1Achievements: this.countTPAchievements(trades, 1),
        tp2Achievements: this.countTPAchievements(trades, 2),
        tp3Achievements: this.countTPAchievements(trades, 3),
      },
    };
  }

  /**
   * Calculate how much breakeven saved
   */
  private calculateBreakevenSavings(trades: Trade[]): number {
    return trades.filter(
      (t) =>
        t.breakevenActivated &&
        t.positions.some((p) => p.closeReason === "breakeven_sl")
    ).length;
  }

  /**
   * Count TP level achievements
   */
  private countTPAchievements(trades: Trade[], level: number): number {
    return trades.filter((t) =>
      t.positions.some((p) => p.closeReason === `tp${level}`)
    ).length;
  }

  /**
   * Analyze signal sources
   */
  private analyzeSignalSources(trades: Trade[]): any {
    const byChannel: { [key: string]: any } = {};

    for (const trade of trades) {
      const channelName = trade.signal?.channel?.title || "Unknown";

      if (!byChannel[channelName]) {
        byChannel[channelName] = {
          trades: 0,
          wins: 0,
          losses: 0,
          profit: 0,
        };
      }

      byChannel[channelName].trades++;
      if (trade.netProfit > 0) byChannel[channelName].wins++;
      if (trade.netProfit < 0) byChannel[channelName].losses++;
      byChannel[channelName].profit += trade.netProfit;
    }

    return byChannel;
  }

  /**
   * Generate insights
   */
  private generateInsights(stats: ReportStatistics, trades: Trade[]): string[] {
    const insights: string[] = [];

    // Win rate insight
    if (stats.tradingStats.winRate >= 70) {
      insights.push(
        `Excellent win rate of ${stats.tradingStats.winRate.toFixed(1)}% - you're doing great!`
      );
    } else if (stats.tradingStats.winRate < 40) {
      insights.push(
        `Win rate of ${stats.tradingStats.winRate.toFixed(1)}% is below optimal - review your signal selection`
      );
    }

    // Profit factor insight
    if (stats.performanceMetrics.profitFactor > 2) {
      insights.push(
        `Strong profit factor of ${stats.performanceMetrics.profitFactor.toFixed(2)} shows excellent risk management`
      );
    }

    // Breakeven insight
    if (stats.riskMetrics.breakevenSaved > 0) {
      insights.push(
        `Breakeven protection saved you from ${stats.riskMetrics.breakevenSaved} potential losses`
      );
    }

    // Largest win
    if (stats.financialStats.largestWin > 0) {
      insights.push(
        `Best trade today: +$${stats.financialStats.largestWin.toFixed(2)}`
      );
    }

    return insights;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    stats: ReportStatistics,
    trades: Trade[]
  ): string[] {
    const recommendations: string[] = [];

    // Win rate recommendation
    if (stats.tradingStats.winRate < 50) {
      recommendations.push(
        "Consider being more selective with signals - quality over quantity"
      );
    }

    // Risk management
    if (stats.performanceMetrics.profitFactor < 1.5) {
      recommendations.push(
        "Review your risk management - aim for profit factor above 2.0"
      );
    }

    // TP achievements
    const tp1Rate =
      stats.tradingStats.totalTrades > 0
        ? (stats.riskMetrics.tp1Achievements / stats.tradingStats.totalTrades) * 100
        : 0;
    
    if (tp1Rate < 50) {
      recommendations.push(
        "Consider tighter TP1 levels to lock in profits more frequently"
      );
    }

    return recommendations;
  }

  /**
   * ✅ SEND DAILY REPORT EMAIL WITH TEMPLATE
   */
  private async sendDailyReportEmail(
    user: User,
    stats: ReportStatistics,
    insights: string[],
    recommendations: string[],
    reportDate: Date
  ): Promise<void> {
    try {
      // Prepare data for email template
      const emailData: DailyReportData = {
        userName: user.fullName,
        reportDate: reportDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        tradingStats: stats.tradingStats,
        financialStats: stats.financialStats,
        performanceMetrics: stats.performanceMetrics,
        riskMetrics: stats.riskMetrics,
        insights,
        recommendations,
      };

      // Generate email using template
      const { subject, html, text } = generateDailyReportEmail(emailData);

      // Queue email for delivery
      await this.emailService['queueEmail']({
        to: user.email,
        subject,
        html,
        text,
        userId: user.id,
        emailType: 'daily_report' as any,
      });

      console.log(`   📧 Daily report email queued for ${user.email}`);
    } catch (error) {
      console.error("   ⚠️  Failed to send daily report email:", error);
      // Don't throw - report was saved, email is optional
    }
  }
}