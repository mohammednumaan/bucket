import express, { Request, Response, NextFunction } from 'express';
import RateLimiter from './rate_limiter.js';
import redisClient from './redis.js';
import os from 'os';


const app = express();
const rateLimiter = new RateLimiter(redisClient, 10, 2, 5);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip!.toString();
    const allowed = await rateLimiter.attemptRequest(key, 1);
    const hostname = os.hostname();

    if (!allowed){
        return res.status(429).json({
            message: `${hostname}: Too many requests. Please try again later.`
        });
    }

    next();
}

app.get('/api/test', rateLimitMiddleware, (req: Request, res: Response) => {
    const hostname = os.hostname();
    res.json({
        message: `${hostname}: Request successfull!`
    });
});

app.listen(PORT, () => {
    console.log(`[Server] running on port ${PORT}`);
});
