// FILE: src/jobs/signal-expiration.job.ts
// =============================================
import { SignalService } from '../services/signal.service';

export class SignalExpirationJob {
  private signalService: SignalService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.signalService = new SignalService();
  }

  /**
   * Start the expiration check job (runs every 5 minutes)
   */
  start(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      console.log('⚠️  Signal expiration job already running');
      return;
    }

    console.log(`⏰ Starting signal expiration job (checking every ${intervalMinutes} minutes)`);

    // Run immediately
    this.checkExpiredSignals();

    // Then run periodically
    this.intervalId = setInterval(
      () => this.checkExpiredSignals(),
      intervalMinutes * 60 * 1000
    );

    this.isRunning = true;
  }

  /**
   * Stop the job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('⏰ Signal expiration job stopped');
    }
  }

  /**
   * Check and expire old signals
   * FIXED: expireOldSignals() now returns Promise<number>
   */
  private async checkExpiredSignals(): Promise<void> {
    try {
      const expiredCount = await this.signalService.expireOldSignals();
      
      if (expiredCount > 0) {
        console.log(`⏰ Expired ${expiredCount} signals at ${new Date().toISOString()}`);
      }
    } catch (error) {
      console.error('❌ Error in signal expiration job:', error);
    }
  }

  /**
   * Check if job is running
   */
  getStatus(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let expirationJobInstance: SignalExpirationJob | null = null;

export function getSignalExpirationJob(): SignalExpirationJob {
  if (!expirationJobInstance) {
    expirationJobInstance = new SignalExpirationJob();
  }
  return expirationJobInstance;
}

export function startSignalExpirationJob(intervalMinutes: number = 5): void {
  const job = getSignalExpirationJob();
  job.start(intervalMinutes);
}

export function stopSignalExpirationJob(): void {
  if (expirationJobInstance) {
    expirationJobInstance.stop();
    expirationJobInstance = null;
  }
}