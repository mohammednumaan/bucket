import type { RedisTokenBucketClient } from "../redis.js";

export type RateLimiterResult = {
  allowed: -1 | 0 | 1;
  remaining: number;
  retryAfter: number;
};

type TokenBucketConfig = {
  capacity: number;
  refillRate: number;
  interval: number;
  keyPrefix?: string;
};

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
}

export default class TokenBucket {
  private store: RedisTokenBucketClient;
  private capacity: number;
  private refillRate: number;
  private interval: number;
  private keyPrefix: string;

  constructor(store: RedisTokenBucketClient, config: TokenBucketConfig) {
    assertPositiveInteger(config.capacity, "capacity");
    assertPositiveInteger(config.refillRate, "refillRate");
    assertPositiveInteger(config.interval, "interval");

    if (config.keyPrefix !== undefined && config.keyPrefix.trim().length === 0) {
      throw new Error("keyPrefix must be a non-empty string");
    }

    this.store = store;
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.interval = config.interval;
    this.keyPrefix = config.keyPrefix || "rl";
  }

  async consume(key: string, requested: number = 1): Promise<RateLimiterResult> {
    const redisKey = `${this.keyPrefix}:${key}`;
    const [allowed, remaining, retryAfter] = await this.store.consumeToken(redisKey, this.capacity, this.refillRate, this.interval, requested);
    return { allowed: allowed as 0 | 1 | -1, remaining, retryAfter };
  }
}
