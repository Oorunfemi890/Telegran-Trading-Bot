// FILE: src/workers/execution.worker.ts
// =============================================
// PHASE 8: TRADE EXECUTION WORKER
// =============================================

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis.config';
import { TradeExecutorService } from '../services/trade.executor';

export interface TradeExecutionJob {
  userId: string;
  signalId: string;
  userEmail: string;
  userName: string;
  symbol: string;
  direction: string;
}

export class ExecutionWorker {
  private worker: Worker | null = null;
  private executor: TradeExecutorService;

  constructor() {
    this.executor = new TradeExecutorService();
  }

  /**
   * Start the execution worker
   */
  start(): void {
    const redis = getRedisClient();

    if (!redis || redis.status !== 'ready') {
      console.log('⚠️  Redis not available - execution worker not started');
      return;
    }

    this.worker = new Worker(
      'trade-execution',
      async (job: Job<TradeExecutionJob>) => {
        return await this.processJob(job);
      },
      {
        connection: redis,
        concurrency: 3, // Execute 3 trades concurrently
        limiter: {
          max: 5,
          duration: 1000,
        },
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`✅ Execution job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Execution job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('❌ Execution worker error:', err);
    });

    console.log('✅ Trade execution worker started');
  }

  /**
   * Process a single execution job
   */
  private async processJob(job: Job<TradeExecutionJob>): Promise<any> {
    const { userId, signalId, userName, symbol } = job.data;

    console.log(`\n⚡ EXECUTION JOB: ${job.id}`);
    console.log(`   User: ${userName}`);
    console.log(`   Symbol: ${symbol}`);

    try {
      const result = await this.executor.executeTrade(userId, signalId);

      await job.updateProgress(100);

      return result;
    } catch (error: any) {
      console.error('   ❌ Execution failed:', error.message);
      throw error;
    }
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      console.log('✅ Execution worker stopped');
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
let executionWorkerInstance: ExecutionWorker | null = null;

export function getExecutionWorker(): ExecutionWorker {
  if (!executionWorkerInstance) {
    executionWorkerInstance = new ExecutionWorker();
  }
  return executionWorkerInstance;
}

export function startExecutionWorker(): void {
  const worker = getExecutionWorker();
  worker.start();
}

export async function stopExecutionWorker(): Promise<void> {
  if (executionWorkerInstance) {
    await executionWorkerInstance.stop();
    executionWorkerInstance = null;
  }
}