// FILE: src/jobs/metrics-push.job.ts
// =============================================
// PHASE 12: REAL-TIME METRICS PUSH TO ADMINS
// =============================================

import { SystemMetricsService } from '../services/admin/system-metrics.service';
import { getWebSocketServer } from '../websocket/socket.server';

export class MetricsPushScheduler {
  private metricsService: SystemMetricsService;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.metricsService = new SystemMetricsService();
  }

  /**
   * Start pushing metrics to admins every N seconds
   */
  start(intervalSeconds: number = 30): void {
    if (this.isRunning) {
      console.log('⚠️  Metrics push scheduler already running');
      return;
    }

    console.log(`📊 Starting real-time metrics push (every ${intervalSeconds}s)`);

    // Push immediately
    this.pushMetrics();

    // Then push periodically
    this.intervalId = setInterval(
      () => this.pushMetrics(),
      intervalSeconds * 1000
    );

    this.isRunning = true;
  }

  /**
   * Push current metrics to all connected admins
   */
  private async pushMetrics(): Promise<void> {
    try {
      const wsServer = getWebSocketServer();
      if (!wsServer) return;

      // Only push if there are connected admins
      const connectedCount = wsServer.getConnectedUsersCount();
      if (connectedCount === 0) return;

      const metrics = await this.metricsService.getSystemMetrics();

      wsServer.emitSystemMetrics(metrics);

      // Silent success - no log spam
    } catch (error) {
      // Silent error - metrics push is not critical
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
      console.log('📊 Metrics push scheduler stopped');
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
let metricsPushInstance: MetricsPushScheduler | null = null;

export function getMetricsPushScheduler(): MetricsPushScheduler {
  if (!metricsPushInstance) {
    metricsPushInstance = new MetricsPushScheduler();
  }
  return metricsPushInstance;
}

export function startMetricsPushScheduler(intervalSeconds: number = 30): void {
  const scheduler = getMetricsPushScheduler();
  scheduler.start(intervalSeconds);
}

export function stopMetricsPushScheduler(): void {
  if (metricsPushInstance) {
    metricsPushInstance.stop();
    metricsPushInstance = null;
  }
}