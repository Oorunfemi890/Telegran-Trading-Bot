// FILE: src/jobs/monitoring.job.ts
// =============================================
// PHASE 9: MONITORING JOB SCHEDULER
// =============================================

import { Queue } from 'bullmq';
import { getRedisClient } from '../config/redis.config';

export class MonitoringJobScheduler {
  private queue: Queue | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.initializeQueue();
  }

  /**
   * Initialize the monitoring queue
   */
  private initializeQueue() {
    const redis = getRedisClient();
    
    if (redis && redis.status === 'ready') {
      this.queue = new Queue('position-monitoring', {
        connection: redis,
      });
      console.log('✅ Monitoring queue initialized');
    }
  }

  /**
   * Start the monitoring scheduler (runs every 5 seconds)
   */
  start(intervalSeconds: number = 5): void {
    if (this.isRunning) {
      console.log('⚠️  Monitoring scheduler already running');
      return;
    }

    if (!this.queue) {
      console.log('⚠️  Monitoring queue not available - scheduler not started');
      return;
    }

    console.log(`⏰ Starting monitoring scheduler (every ${intervalSeconds}s)`);

    // Run immediately
    this.queueMonitoringJob();

    // Then run periodically
    this.intervalId = setInterval(
      () => this.queueMonitoringJob(),
      intervalSeconds * 1000
    );

    this.isRunning = true;
  }

  /**
   * Queue a monitoring job
   */
  private async queueMonitoringJob(): Promise<void> {
    if (!this.queue) return;

    try {
      await this.queue.add(
        'monitor-all-trades',
        { monitorAll: true },
        {
          priority: 2, // Medium priority
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
    } catch (error) {
      console.error('❌ Failed to queue monitoring job:', error);
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
      console.log('⏰ Monitoring scheduler stopped');
    }
  }

  /**
   * Check if scheduler is running
   */
  getStatus(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
let monitoringJobInstance: MonitoringJobScheduler | null = null;

export function getMonitoringScheduler(): MonitoringJobScheduler {
  if (!monitoringJobInstance) {
    monitoringJobInstance = new MonitoringJobScheduler();
  }
  return monitoringJobInstance;
}

export function startMonitoringScheduler(intervalSeconds: number = 5): void {
  const scheduler = getMonitoringScheduler();
  scheduler.start(intervalSeconds);
}

export function stopMonitoringScheduler(): void {
  if (monitoringJobInstance) {
    monitoringJobInstance.stop();
    monitoringJobInstance = null;
  }
}