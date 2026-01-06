// FILE: src/index.ts - UPDATED WITH PHASE 11 & 12
// =============================================
import "reflect-metadata";
import { config } from "dotenv";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { createServer } from "http";
import { initializeDatabase, closeDatabase } from "./config/database.config";
import {
  initializeRedis,
  closeRedis,
  getRedisClient,
} from "./config/redis.config";
import { TelegramListenerService } from "./services/telegram.listener";
import {
  initializeWebSocketServer,
  getWebSocketServer,
} from "./websocket/socket.server";

// Workers
import { startSignalWorker, stopSignalWorker } from "./workers/signal.worker";
import {
  startExecutionWorker,
  stopExecutionWorker,
} from "./workers/execution.worker";
import {
  startMonitoringWorker,
  stopMonitoringWorker,
} from "./workers/monitoring.worker";

// Job Schedulers
import {
  startSignalExpirationJob,
  stopSignalExpirationJob,
} from "./jobs/signal-expiration.job";
import {
  startMonitoringScheduler,
  stopMonitoringScheduler,
} from "./jobs/monitoring.job";
import {
  startDailyReportScheduler,
  stopDailyReportScheduler,
} from "./jobs/daily-report.job";
import {
  startMetricsPushScheduler,
  stopMetricsPushScheduler,
} from "./jobs/metrics-push.job";
import {
  startSubscriptionReminderJob,
  stopSubscriptionReminderJob,
} from './jobs/subscription-reminder.job';

config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

// Service instances
let telegramListener: TelegramListenerService | null = null;

// =============================================
// MIDDLEWARE SETUP
// =============================================

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "*",
    credentials: process.env.CORS_CREDENTIALS === "true",
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// =============================================
// HEALTH CHECK ROUTES
// =============================================

app.get("/health", (_req: Request, res: Response) => {
  const wsServer = getWebSocketServer();

  res.status(200).json({
    success: true,
    message: "Trading Bot API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    services: {
      telegram: telegramListener?.isActive() || false,
      redis: getRedisClient() !== null,
      websocket: wsServer !== null,
      connectedClients: wsServer?.getConnectedUsersCount() || 0,
    },
  });
});

// =============================================
// API ROUTES
// =============================================
import authRoutes from "./routes/auth.routes";
import channelRoutes from "./routes/channel.routes";
import tradeRoutes from "./routes/trade.routes";
 import channelRequestRoutes from './routes/channel-request.routes';

// Admin routes
import adminInvitationRoutes from "./routes/admin/invitation.routes";
import adminUsersRoutes from "./routes/admin/users.routes";
import adminSystemRoutes from "./routes/admin/system.routes";
import analyticsRouter from "./routes/admin/analytics.routes";

app.get("/api/v1", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Trading Bot API v1",
    endpoints: {
      auth: "/api/v1/auth",
      channels: "/api/v1/channels",
      users: "/api/v1/users",
      trades: "/api/v1/trades",
      signals: "/api/v1/signals",
      admin: {
        invitations: "/api/v1/admin/invitations",
        users: "/api/v1/admin/users",
        system: "/api/v1/admin/system",
        analytics: "/api/v1/admin/analytics",
      },
      websocket: "/socket.io",
    },
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/channels", channelRoutes);
app.use("/api/v1/trades", tradeRoutes);
app.use('/api/v1/channel-requests', channelRequestRoutes);

// Admin routes
app.use("/api/v1/admin/invitations", adminInvitationRoutes);
app.use("/api/v1/admin/users", adminUsersRoutes);
app.use("/api/v1/admin/system", adminSystemRoutes);
app.use("/api/v1/admin/analytics", analyticsRouter);

// =============================================
// ERROR HANDLING
// =============================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// =============================================
// SERVER INITIALIZATION
// =============================================

async function startServer() {
  try {
    console.log("🚀 Starting Telegram Trading Bot...\n");

    // Initialize database
    console.log("📊 Connecting to database...");
    await initializeDatabase();
    console.log("✅ Database connected successfully\n");

    // Initialize Redis
    console.log("🔴 Connecting to Redis...");
    await initializeRedis();

    // PHASE 12: Initialize WebSocket Server
    console.log("\n🔌 Initializing WebSocket server...");
    initializeWebSocketServer(httpServer);
    console.log("✅ WebSocket server initialized\n");

    // Start background workers (only if Redis is available)
    if (getRedisClient()) {
      console.log("⚙️  Starting background workers...");

      startSignalWorker();
      console.log("✅ Signal worker started");

      startExecutionWorker();
      console.log("✅ Execution worker started");

      startMonitoringWorker();
      console.log("✅ Monitoring worker started");
    }

    // Start scheduled jobs
    console.log("\n⏰ Starting scheduled jobs...");

    startSignalExpirationJob(5);
    console.log("✅ Signal expiration job started (5 min intervals)");

    startDailyReportScheduler(0, 0);
    console.log("✅ Daily report job started (midnight)\n");

    startMetricsPushScheduler(30); // Push every 30 seconds
    console.log("✅ Metrics push job started (30s intervals)\n");

   startSubscriptionReminderJob();
console.log('✅ Subscription reminder job started\n');

    // Start Telegram Listener
    if (process.env.TELEGRAM_ENABLED === "true") {
      console.log("📡 Starting Telegram listener...");
      telegramListener = new TelegramListenerService();
      await telegramListener.start();
    } else {
      console.log("⚠️  Telegram listener disabled in configuration\n");
    }

    // Start HTTP server (includes WebSocket)
    httpServer.listen(PORT, () => {
      const wsServer = getWebSocketServer();

      console.log("==========================================");
      console.log("✅ TRADING BOT SERVER RUNNING");
      console.log("==========================================");
      console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Server URL: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`📡 API Base: http://localhost:${PORT}/api/v1`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/socket.io`);
      console.log("==========================================");
      console.log("📋 SYSTEM STATUS:");
      console.log(`   ✅ Database: Connected`);
      console.log(
        `   ${getRedisClient() ? "✅" : "⚠️ "} Redis: ${getRedisClient() ? "Connected" : "Disabled"}`
      );
      console.log(
        `   ${telegramListener?.isActive() ? "✅" : "⚠️ "} Telegram: ${telegramListener?.isActive() ? "Listening" : "Disabled"}`
      );
      console.log(
        `   ✅ WebSocket: Active (${wsServer?.getConnectedUsersCount() || 0} clients)`
      );
      console.log(
        `   ✅ Workers: ${getRedisClient() ? "Running (3)" : "Disabled"}`
      );
      console.log(`   ✅ Jobs: Running (2)`);
      console.log("==========================================");
      console.log("🎯 PHASES IMPLEMENTED:");
      console.log("   ✅ Phase 1-10: Core System");
      console.log("   ✅ Phase 11: Admin Dashboard Backend");
      console.log("   ✅ Phase 12: WebSocket Real-time");
      console.log("==========================================\n");

      if (telegramListener?.isActive()) {
        console.log("🎧 Bot is now listening for signals!");
        console.log("💡 Post a signal in a monitored channel to test\n");
      }
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);

      try {
        httpServer.close();

        if (telegramListener) {
          console.log("⏹️  Stopping Telegram listener...");
          await telegramListener.stop();
        }

        if (getRedisClient()) {
          console.log("⏹️  Stopping workers...");
          await stopSignalWorker();
          await stopExecutionWorker();
          await stopMonitoringWorker();
        }

        console.log("⏹️  Stopping scheduled jobs...");
        stopSignalExpirationJob();
        // stopMonitoringScheduler();
        stopDailyReportScheduler();
        stopMetricsPushScheduler(); // ✅ ADD THIS
        stopSubscriptionReminderJob();

        console.log("⏹️  Closing connections...");
        await closeRedis();
        await closeDatabase();

        console.log("✅ All services stopped gracefully");
        process.exit(0);
      } catch (error) {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

export default app;
