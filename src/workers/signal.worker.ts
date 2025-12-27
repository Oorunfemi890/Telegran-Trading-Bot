// FILE: src/workers/signal.worker.ts
// =============================================
import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis.config';
import { SignalHandler } from '../handlers/signal.handler';
import { SignalService } from '../services/signal.service';

export interface SignalProcessingJob {
  channelId: string;
  messageId: string;
  messageText: string;
  messageTime: Date;
}

export class SignalWorker {
  private worker: Worker | null = null;
  private signalHandler: SignalHandler;
  private signalService: SignalService;

  constructor() {
    this.signalHandler = new SignalHandler();
    this.signalService = new SignalService();
  }

  /**
   * Start the worker
   */
  start(): void {
    const redis = getRedisClient();

    if (!redis || redis.status !== 'ready') {
      console.log('⚠️  Redis not available - signal worker not started');
      return;
    }

    this.worker = new Worker(
      'signal-processing',
      async (job: Job<SignalProcessingJob>) => {
        return await this.processJob(job);
      },
      {
        connection: redis,
        concurrency: 5, // Process 5 signals concurrently
        limiter: {
          max: 10, // Max 10 jobs
          duration: 1000, // per second
        },
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed:`, err.message);
    });

    this.worker.on('error', (err) => {
      console.error('❌ Worker error:', err);
    });

    console.log('✅ Signal worker started');
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job<SignalProcessingJob>): Promise<any> {
    const { channelId, messageId, messageText, messageTime } = job.data;

    console.log(`\n🔄 Processing signal job: ${job.id}`);
    console.log(`   Channel: ${channelId}`);
    console.log(`   Message: ${messageId}`);

    try {
      // Step 1: Parse and save the signal
      const result = await this.signalService.processMessage(
        channelId,
        messageId,
        messageText,
        new Date(messageTime)
      );

      if (!result.success) {
        console.log(`   ℹ️  Not a valid signal: ${result.error}`);
        return { processed: false, reason: result.error };
      }

      if (!result.signalId) {
        console.log('   ⚠️  Signal processed but no ID returned');
        return { processed: false, reason: 'No signal ID' };
      }

      console.log(`   ✅ Signal saved: ${result.signalId}`);

      // Step 2: Find eligible users and queue trades
      await this.signalHandler.processNewSignal(result.signalId);

      // Update job progress
      await job.updateProgress(100);

      return {
        processed: true,
        signalId: result.signalId,
      };
    } catch (error: any) {
      console.error('   ❌ Error processing job:', error.message);
      throw error; // Will trigger retry
    }
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      console.log('✅ Signal worker stopped');
    }
  }

  /**
   * Check worker status
   */
  isRunning(): boolean {
    return this.worker !== null && !this.worker.closing;
  }
}

// Singleton instance
let signalWorkerInstance: SignalWorker | null = null;

export function getSignalWorker(): SignalWorker {
  if (!signalWorkerInstance) {
    signalWorkerInstance = new SignalWorker();
  }
  return signalWorkerInstance;
}

export function startSignalWorker(): void {
  const worker = getSignalWorker();
  worker.start();
}

export async function stopSignalWorker(): Promise<void> {
  if (signalWorkerInstance) {
    await signalWorkerInstance.stop();
    signalWorkerInstance = null;
  }
}