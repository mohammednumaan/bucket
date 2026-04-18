import { RateLimiterRedis } from "./redis.js";

export default class RateLimiter {

    private client: RateLimiterRedis
    private capacity: number;
    private refillRate: number;
    private interval: number;

    constructor(client: RateLimiterRedis, capacity: number, refillRate: number, interval: number){

        this.client = client;
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.interval = interval;
    }

    public async attemptRequest(key: string, tokens: number = 1){
        const redisKey = `rate_limiter:${key}`;
        try {
            const [allowed] = await this.client.consumeToken(
                redisKey,
                this.capacity,
                this.refillRate,
                this.interval,
                tokens
            )

            return allowed == 1;
        }
        catch (err) {
            console.error("Error consuming token:", err);
            return false;
        }

    }
}
