// FILE: src/middleware/rateLimit.middleware.ts
// =============================================
import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../config/redis.config';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

// In-memory fallback when Redis is unavailable
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

export const rateLimit = (options: RateLimitOptions) => {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip || 'unknown',
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const redis = getRedisClient();
    const key = `rate_limit:${keyGenerator(req)}`;
    const now = Date.now();

    try {
      if (redis && redis.status === 'ready') {
        // Use Redis for rate limiting
        const windowStart = now - windowMs;

        await redis.zremrangebyscore(key, 0, windowStart);
        const requestCount = await redis.zcard(key);

        if (requestCount >= maxRequests) {
          res.status(429).json({
            success: false,
            message,
            retryAfter: Math.ceil(windowMs / 1000),
          });
          return;
        }

        await redis.zadd(key, now, `${now}-${Math.random()}`);
        await redis.expire(key, Math.ceil(windowMs / 1000));

        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', maxRequests - requestCount - 1);
      } else {
        // Fallback to in-memory rate limiting
        const record = inMemoryStore.get(key);

        if (record && now < record.resetAt) {
          if (record.count >= maxRequests) {
            res.status(429).json({
              success: false,
              message,
              retryAfter: Math.ceil((record.resetAt - now) / 1000),
            });
            return;
          }
          record.count++;
        } else {
          inMemoryStore.set(key, {
            count: 1,
            resetAt: now + windowMs,
          });
        }

        // Clean up old entries periodically
        if (Math.random() < 0.01) {
          for (const [k, v] of inMemoryStore.entries()) {
            if (now > v.resetAt) {
              inMemoryStore.delete(k);
            }
          }
        }
      }

      next();
    } catch (error) {
      console.error('Rate limit error:', error);
      // On error, allow request through
      next();
    }
  };
};

// UPDATED RATE LIMITERS - More generous limits
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 attempts per 15 minutes (was 5)
  message: 'Too many authentication attempts, please try again in 15 minutes',
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200, // 200 requests per minute (was 100)
  message: 'API rate limit exceeded, please try again shortly',
});

export const registrationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 registrations per minute
  message: 'Registration rate limit exceeded',
});

export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // 50 requests per minute (was 10)
  message: 'Rate limit exceeded',
});

// For trade execution - very high limit
export const tradeExecutionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 500, // 500 trades per minute
  message: 'Trade execution rate limit exceeded',
});