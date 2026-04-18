import express, { Request, Response } from "express";
import os from "os";

import redisClient from "./redis.js";
import RateLimiter from "./rate_limiter/rateLimiter.js";
import { useRateLimiterMiddleware } from "./middleware/rateLimiter.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

const rateLimiter = new RateLimiter(redisClient, {
  capacity: 10,
  refillRate: 2,
  interval: 5,
  keyPrefix: "rl",
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/test", useRateLimiterMiddleware(rateLimiter), (_req: Request, res: Response) => {
  const hostname = os.hostname();
  res.json({ message: `${hostname}: Request successful!` });
});

app.listen(PORT, () => {
  console.log(`[Server] running on port ${PORT}`);
});
