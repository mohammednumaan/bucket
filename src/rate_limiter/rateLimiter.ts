import type { RedisTokenBucketClient } from "../redis.js";
import TokenBucket from "./tokenBucket.js";

type RateLimiterConfig = {
  capacity: number;
  refillRate: number;
  interval: number;
  keyPrefix?: string;
};

export default class RateLimiter {
  private readonly bucket: TokenBucket;

  constructor(store: RedisTokenBucketClient, config: RateLimiterConfig) {
    this.bucket = new TokenBucket(store, config);
  }

  async attemptRequest(key: string, tokens: number = 1) {
    return await this.bucket.consume(key, tokens);
  }
}
