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
  public readonly capacity: number;

  constructor(store: RedisTokenBucketClient, config: RateLimiterConfig) {
    this.bucket = new TokenBucket(store, config);
    this.capacity = config.capacity;
  }

  async attemptRequest(key: string, tokens: number = 1) {
    return await this.bucket.consume(key, tokens);
  }
}
