import type { RedisTokenBucketClient } from "../redis.js";

export type RateLimiterResult = {
  allowed: 0 | 1;
  remaining: number;
};

type TokenBucketConfig = {
  capacity: number;
  refillRate: number;
  interval: number;
  keyPrefix?: string;
};

export default class TokenBucket {
  private store: RedisTokenBucketClient;
  private capacity: number;
  private refillRate: number;
  private interval: number;
  private keyPrefix: string;

  constructor(store: RedisTokenBucketClient, config: TokenBucketConfig) {
    this.store = store;
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.interval = config.interval;
    this.keyPrefix = config.keyPrefix || "rl";
  }

  async consume(key: string, requested: number = 1): Promise<RateLimiterResult> {
    const redisKey = `${this.keyPrefix}:${key}`;
    const [allowed, remaining] = await this.store.consumeToken(
      redisKey,
      this.capacity,
      this.refillRate,
      this.interval,
      requested
    );
    return { allowed: allowed as 0 | 1, remaining };
  }
}
