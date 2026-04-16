import { Redis } from "ioredis";
import TokenBucketManager, { Bucket } from "./token";

export default class RateLimiter {

    private client: Redis;
    private capacity: number;
    private refillRate: number;
    private interval: number;
    constructor(client: Redis, capacity: number, refillRate: number, interval: number){

        this.client = client;
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.interval = interval;
    }

    public async attemptRequest(key: string, tokens: number = 1){
        const redisKey = `rate_limiter:${key}`;
        const redisData = await this.client.hgetall(redisKey);
        let bucket = TokenBucketManager.toBucket(redisData);

        let isNewBucket = false;

        if (!bucket) {
            bucket = new Bucket(this.capacity, this.refillRate, this.interval);
            isNewBucket = true;
        }

        const allowed = TokenBucketManager.consume(bucket, tokens);
        if (allowed || isNewBucket) {
            await this.client.hset(redisKey, bucket);
        }
        
        return allowed;
    }
}
