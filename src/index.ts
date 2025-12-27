// FILE: src/index.ts (COMPLETE WITH ALL WORKERS)
// =============================================
import "reflect-metadata";
import { config } from "dotenv";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { initializeDatabase, closeDatabase } from "./config/database.config";
import { initializeRedis, closeRedis, getRedisClient } from "./config/redis.config";
import { TelegramListenerService } from "./services/telegram.listener";
import { startSignalWorker, stopSignalWorker } from "./workers/signal.worker";
import { startSignalExpirationJob, stopSignalExpirationJob } from "./jobs/signal-expiration.job";

config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

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
  res.status(200).json({
    success: true,
    message: "Trading Bot API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
    services: {
      telegram: telegramListener?.isActive() || false,
      redis: getRedisClient() !== null,
    },
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: "Telegram Trading Bot",
    status: "operational",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      telegram: {
        listening: telegramListener?.isActive() || false,
        enabled: process.env.TELEGRAM_ENABLED === 'true',
      },
      redis: {
        connected: getRedisClient() !== null,
      },
      database: {
        connected: true,
      },
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024),
    },
  });
});

// =============================================
// API ROUTES
// =============================================
import authRoutes from "./routes/auth.routes";
import channelRoutes from "./routes/channel.routes";

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
      admin: "/api/v1/admin",
    },
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/channels", channelRoutes);

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

    // Start background workers (only if Redis is available)
    if (getRedisClient()) {
      console.log("⚙️  Starting background workers...");
      startSignalWorker();
      console.log("✅ Signal worker started");
    }

    // Start scheduled jobs
    console.log("⏰ Starting scheduled jobs...");
    startSignalExpirationJob(5); // Check every 5 minutes
    console.log("✅ Signal expiration job started\n");

    // Start Telegram Listener
    if (process.env.TELEGRAM_ENABLED === 'true') {
      console.log("📡 Starting Telegram listener...");
      telegramListener = new TelegramListenerService();
      await telegramListener.start();
    } else {
      console.log("⚠️  Telegram listener disabled in configuration\n");
    }

    // Start HTTP server
    app.listen(PORT, () => {
      console.log("==========================================");
      console.log("✅ TRADING BOT SERVER RUNNING");
      console.log("==========================================");
      console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Server URL: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`📡 API Base: http://localhost:${PORT}/api/v1`);
      console.log("==========================================");
      console.log("📋 SYSTEM STATUS:");
      console.log(`   ✅ Database: Connected`);
      console.log(`   ${getRedisClient() ? '✅' : '⚠️ '} Redis: ${getRedisClient() ? 'Connected' : 'Disabled'}`);
      console.log(`   ${telegramListener?.isActive() ? '✅' : '⚠️ '} Telegram: ${telegramListener?.isActive() ? 'Listening' : 'Disabled'}`);
      console.log(`   ✅ Workers: ${getRedisClient() ? 'Running' : 'Disabled'}`);
      console.log(`   ✅ Jobs: Running`);
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
        // Stop Telegram listener
        if (telegramListener) {
          console.log("⏹️  Stopping Telegram listener...");
          await telegramListener.stop();
        }

        // Stop workers
        if (getRedisClient()) {
          console.log("⏹️  Stopping workers...");
          await stopSignalWorker();
        }

        // Stop jobs
        console.log("⏹️  Stopping scheduled jobs...");
        stopSignalExpirationJob();

        // Close connections
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

// Start the server
startServer();

export default app;