// FILE: src/config/redis.config.ts
// =============================================
import Redis from "ioredis";

let redisClient: Redis | null = null;

const createRedisClient = (): Redis | null => {
  const redisEnabled = process.env.REDIS_ENABLED !== "false";

  if (!redisEnabled) {
    console.log("⚠️  Redis disabled - some features will be limited");
    return null;
  }

  try {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      // Upstash Redis URL (with TLS)
      return new Redis(redisUrl, {
        maxRetriesPerRequest: null, // CRITICAL for BullMQ
        enableReadyCheck: false,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.error("❌ Redis connection failed after 3 retries");
            return null;
          }
          return Math.min(times * 2000, 5000);
        },
        reconnectOnError: (err: Error) => {
          const targetError = "READONLY";
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
        tls: {
          rejectUnauthorized: false,
        },
        family: 4,
      });
    } else {
      // Local Redis
      return new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || "0"),
        maxRetriesPerRequest: null, // CRITICAL for BullMQ
        enableReadyCheck: true,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        retryStrategy: (times: number) => {
          if (times > 3) {
            return null;
          }
          return Math.min(times * 1000, 3000);
        },
      });
    }
  } catch (error) {
    console.error("❌ Redis client creation failed:", error);
    return null;
  }
};

export const initializeRedis = async (): Promise<void> => {
  try {
    console.log("🔄 Initializing Redis...");

    redisClient = createRedisClient();

    if (!redisClient) {
      console.log(
        "⚠️  Running without Redis - rate limiting and queues disabled"
      );
      return;
    }

    redisClient.on("error", (error: Error) => {
      if (
        !error.message.includes("ECONNREFUSED") &&
        !error.message.includes("enableOfflineQueue")
      ) {
        console.error("Redis error:", error.message);
      }
    });

    redisClient.on("connect", () => {
      console.log("🔄 Redis connecting...");
    });

    redisClient.on("ready", () => {
      console.log("✅ Redis ready and connected\n");
    });

    redisClient.on("close", () => {
      console.log("⚠️  Redis connection closed");
    });

    redisClient.on("reconnecting", () => {
      console.log("🔄 Redis reconnecting...");
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Redis connection timeout"));
      }, 10000);

      redisClient!.once("ready", () => {
        clearTimeout(timeout);
        resolve();
      });

      redisClient!.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  } catch (error) {
    console.error("❌ Redis initialization failed:", (error as Error).message);
    console.log(
      "⚠️  Continuing without Redis - some features will be disabled\n"
    );

    if (redisClient) {
      try {
        redisClient.disconnect(false);
      } catch (e) {
        // Ignore cleanup errors
      }
      redisClient = null;
    }
  }
};

export const getRedisClient = (): Redis | null => {
  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log("✅ Redis connection closed");
    } catch (error) {
      console.error("Error closing Redis:", error);
    }
  }
};

export default redisClient;
