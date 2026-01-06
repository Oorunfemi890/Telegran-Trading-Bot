// FILE: src/workers/monitoring.worker.ts
// =============================================
// PHASE 9: POSITION MONITORING WORKER
// =============================================

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis.config';
import { PositionMonitorService } from '../services/position.monitor';

export interface MonitoringJob {
  tradeId?: string;
  monitorAll?: boolean;
}

export class MonitoringWorker {
  private worker: Worker | null = null;
  private monitor: PositionMonitorService;

  constructor() {
    this.monitor = new PositionMonitorService();
  }

  /**
   * Start the monitoring worker
   */
  start(): void {
    const redis = getRedisClient();

    if (!redis || redis.status !== 'ready') {
      console.log('⚠️  Redis not available - monitoring worker not started');
      return;
    }

    this.worker = new Worker(
      'position-monitoring',
      async (job: Job<MonitoringJob>) => {
        return await this.processJob(job);
      },
      {
        connection: redis,
        concurrency: 10, // Monitor many trades concurrently
        limiter: {
          max: 20,
          duration: 1000,
        },
      }
    );

    this.worker.on('completed', (_job) => {
      // Silent success
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Monitoring job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('❌ Monitoring worker error:', err);
    });

    console.log('✅ Position monitoring worker started');
  }

  /**
   * Process a single monitoring job
   */
  private async processJob(job: Job<MonitoringJob>): Promise<any> {
    const { tradeId, monitorAll } = job.data;

    try {
      if (monitorAll) {
        await this.monitor.monitorAllActiveTrades();
      } else if (tradeId) {
        await this.monitor.monitorTrade(tradeId);
      }

      await job.updateProgress(100);

      return { success: true };
    } catch (error: any) {
      console.error('Monitoring error:', error.message);
      throw error;
    }
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      console.log('✅ Monitoring worker stopped');
    }
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.worker !== null && !this.worker.closing;
  }
}

// Singleton
let monitoringWorkerInstance: MonitoringWorker | null = null;

export function getMonitoringWorker(): MonitoringWorker {
  if (!monitoringWorkerInstance) {
    monitoringWorkerInstance = new MonitoringWorker();
  }
  return monitoringWorkerInstance;
}

export function startMonitoringWorker(): void {
  const worker = getMonitoringWorker();
  worker.start();
}

export async function stopMonitoringWorker(): Promise<void> {
  if (monitoringWorkerInstance) {
    await monitoringWorkerInstance.stop();
    monitoringWorkerInstance = null;
  }
}