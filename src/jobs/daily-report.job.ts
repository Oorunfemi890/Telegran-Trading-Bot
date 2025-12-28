// FILE: src/jobs/daily-report.job.ts
// =============================================
// PHASE 10: DAILY REPORT JOB SCHEDULER
// =============================================

import { ReportGeneratorService } from '../services/report.generator';

export class DailyReportScheduler {
  private reportGenerator: ReportGeneratorService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.reportGenerator = new ReportGeneratorService();
  }

  /**
   * Start the daily report scheduler
   * Runs at specified time each day (e.g., midnight or 6 AM)
   */
  start(targetHour: number = 0, targetMinute: number = 0): void {
    if (this.isRunning) {
      console.log('⚠️  Daily report scheduler already running');
      return;
    }

    console.log(`⏰ Starting daily report scheduler (${targetHour}:${String(targetMinute).padStart(2, '0')} daily)`);

    // Calculate time until next run
    const now = new Date();
    const target = new Date();
    target.setHours(targetHour, targetMinute, 0, 0);

    // If target time has passed today, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const msUntilTarget = target.getTime() - now.getTime();

    console.log(`   Next report generation: ${target.toLocaleString()}`);

    // Schedule first run
    setTimeout(() => {
      this.generateReports();

      // Then run daily
      this.intervalId = setInterval(
        () => this.generateReports(),
        24 * 60 * 60 * 1000 // Once per day
      );
    }, msUntilTarget);

    this.isRunning = true;
  }

  /**
   * Generate reports for all users
   */
  private async generateReports(): Promise<void> {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('📊 DAILY REPORT GENERATION STARTED');
      console.log('='.repeat(60));
      console.log(`⏰ Time: ${new Date().toLocaleString()}\n`);

      const count = await this.reportGenerator.generateDailyReportsForAllUsers();

      console.log('='.repeat(60));
      console.log(`✅ Daily report generation complete: ${count} reports`);
      console.log('='.repeat(60) + '\n');
    } catch (error) {
      console.error('❌ Daily report generation failed:', error);
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('⏰ Daily report scheduler stopped');
    }
  }

  /**
   * Check if scheduler is running
   */
  getStatus(): boolean {
    return this.isRunning;
  }

  /**
   * Manually trigger report generation (for testing)
   */
  async triggerNow(): Promise<number> {
    console.log('\n🔧 Manually triggering report generation...\n');
    return await this.reportGenerator.generateDailyReportsForAllUsers();
  }
}

// Singleton instance
let dailyReportInstance: DailyReportScheduler | null = null;

export function getDailyReportScheduler(): DailyReportScheduler {
  if (!dailyReportInstance) {
    dailyReportInstance = new DailyReportScheduler();
  }
  return dailyReportInstance;
}

export function startDailyReportScheduler(
  targetHour: number = 0,
  targetMinute: number = 0
): void {
  const scheduler = getDailyReportScheduler();
  scheduler.start(targetHour, targetMinute);
}

export function stopDailyReportScheduler(): void {
  if (dailyReportInstance) {
    dailyReportInstance.stop();
    dailyReportInstance = null;
  }
}

export async function triggerDailyReportNow(): Promise<number> {
  const scheduler = getDailyReportScheduler();
  return await scheduler.triggerNow();
}