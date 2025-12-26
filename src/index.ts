import "reflect-metadata";
import { config } from "dotenv";
import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { initializeDatabase, closeDatabase } from "./config/database.config";
import { initializeRedis, closeRedis } from "./config/redis.config";

// Load environment variables
config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// =============================================
// MIDDLEWARE SETUP
// =============================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "*",
    credentials: process.env.CORS_CREDENTIALS === "true",
  })
);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Compression
app.use(compression());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// =============================================
// HEALTH CHECK ROUTES
// =============================================

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Trading Bot API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
  });
});

app.get("/api/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: "Telegram Trading Bot",
    status: "operational",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
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
import channelRoutes from './routes/channel.routes';

// Mount routes after auth routes (around line 78)
app.use('/api/v1/channels', channelRoutes);

// API v1 base route
app.get("/api/v1", (req: Request, res: Response) => {
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

// Mount routes
app.use("/api/v1/auth", authRoutes);

// =============================================
// ERROR HANDLING
// =============================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
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

    // Initialize Redis (non-blocking)
    console.log("🔴 Connecting to Redis...");
    await initializeRedis();

    // Start server
    app.listen(PORT, () => {
      console.log("==========================================");
      console.log("✅ TRADING BOT SERVER RUNNING");
      console.log("==========================================");
      console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Server URL: http://localhost:${PORT}`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`📡 API Base: http://localhost:${PORT}/api/v1`);
      console.log("==========================================\n");
      console.log("📋 Next Steps:");
      console.log("1. Generate invitation code: npm run generate:invitation");
      console.log("2. Configure Telegram credentials in .env");
      console.log("3. Connect MetaTrader account");
      console.log("4. Subscribe to signal channels\n");
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n⚠️  Received ${signal}, shutting down gracefully...`);

      try {
        await closeRedis();
        await closeDatabase();
        console.log("✅ All connections closed");
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