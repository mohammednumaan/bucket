import type { RedisTokenBucketClient } from "../redis.js";
import { withRetry } from "../utils/retry.js";

export type RateLimiterResult = {
  allowed: 0 | 1;
  remaining: number;
};

type TokenBucketConfig = {
  capacity: number;
  refillRate: number;
  interval: number;
  keyPrefix?: string;
  retries?: number;
};

export default class TokenBucket {
  private store: RedisTokenBucketClient;
  private capacity: number;
  private refillRate: number;
  private interval: number;
  private keyPrefix: string;
  private retries: number;

  constructor(store: RedisTokenBucketClient, config: TokenBucketConfig) {
    this.store = store;
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.interval = config.interval;
    this.keyPrefix = config.keyPrefix || "rl";
    this.retries = config.retries ?? 3;
  }

  async consume(key: string, requested: number = 1): Promise<RateLimiterResult> {
    const redisKey = `${this.keyPrefix}:${key}`;
    const [allowed, remaining] = await withRetry(
      () => this.store.consumeToken(redisKey, this.capacity, this.refillRate, this.interval, requested),
      { retries: this.retries }
    );
    return { allowed: allowed as 0 | 1, remaining };
  }
}
