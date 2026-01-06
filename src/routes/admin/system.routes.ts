// FILE: src/routes/admin/system.routes.ts
import { Router } from 'express';
import { SystemMetricsService } from '../../services/admin/system-metrics.service';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { Request, Response } from 'express';

const router = Router();
const metricsService = new SystemMetricsService();

router.use(authenticate, requireAdmin);

// GET /api/v1/admin/system/metrics
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await metricsService.getSystemMetrics();
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/admin/system/queues
router.get('/queues', async (_req: Request, res: Response) => {
  try {
    const queues = await metricsService.getQueueStatistics();
    res.json({ success: true, data: queues });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/admin/system/health
router.get('/health', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
  });
});

export default router;