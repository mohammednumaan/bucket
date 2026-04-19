import { Request, Response, NextFunction } from 'express';
import RateLimiter from '../rate_limiter/rateLimiter.js';

export function useRateLimiterMiddleware(rateLimiter: RateLimiter) {
  return async function rateLimiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const apiKey = req.headers["x-api-key"] as string | undefined;
    if (!apiKey || typeof apiKey !== "string") {
      res.status(400).json({ error: "missing x-api-key header" });
      return;
    }

    const trimmedKey = apiKey.trim();
    if (trimmedKey.length === 0) {
      res.status(400).json({ error: "invalid x-api-key format" });
      return;
    }
    const result = await rateLimiter.attemptRequest(trimmedKey, 1);
    if (result.allowed === -1) {
      res.status(400).json({ error: "rate limiter error" });
      return;
    }

    res.setHeader("X-RateLimit-Limit", rateLimiter.capacity);
    res.setHeader("X-RateLimit-Remaining", result.remaining);

    if (!result.allowed) {
      res.setHeader("Retry-After", result.retryAfter);
      res.status(429).json({
        error: "rate limit exceeded",
        remaining: result.remaining,
      });
      return;
    }

    next();
  };
}
