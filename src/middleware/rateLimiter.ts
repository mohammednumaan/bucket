import { Request, Response, NextFunction } from 'express';
import RateLimiter from '../rate_limiter/rateLimiter.js';

export function useRateLimiterMiddleware(rateLimiter: RateLimiter) {
    return async function rateLimiterMiddleware(
        req: Request, 
        res: Response, 
        next: NextFunction
    ) {
        const apiKey = req.headers['x-api-key'] as string | undefined;
        if (!apiKey){
            res.status(401).json({ error: 'missing x-api-key header' });
            return;
        }

        const result = await rateLimiter.attemptRequest(apiKey, 1);
        if (!result.allowed){
            res.status(429).json({ 
                error: 'rate limit exceeded', 
                remaining: result.remaining 
            });
            return;
        }

        next();
    }
}
