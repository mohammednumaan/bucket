import express, { Request, Response, NextFunction } from 'express';
import RateLimiter from './rate_limiter.js';
import redisClient from './redis.js';

const app = express();
const rateLimiter = new RateLimiter(redisClient, 10, 2, 5);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip;
    const allowed = await rateLimiter.attemptRequest(key, 1);

    if (!allowed){
        return res.status(429).json({
            message: "Too many requests. Please try again later."
        });
    }

    next();
}

app.get('/api/test', rateLimitMiddleware, (req: Request, res: Response) => {
    res.json({
        message: "Request successfull!"
    });
});

app.listen(PORT, () => {
    console.log(`[Server] running on port ${PORT}`);
});

