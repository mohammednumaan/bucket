import { describe, expect, test } from "@jest/globals";
import type { RedisTokenBucketClient } from "../../src/redis";
import TokenBucket from "../../src/rate_limiter/tokenBucket";

const store = {} as unknown as RedisTokenBucketClient;

describe("TokenBucket constructor validation", () => {
  test("throws when capacity is invalid", () => {
    const create = () =>
      new TokenBucket(store, {
        capacity: 0,
        refillRate: 1,
        interval: 1,
      });

    expect(create).toThrow("capacity must be a positive integer");
  });

  test("throws when refillRate is invalid", () => {
    const create = () =>
      new TokenBucket(store, {
        capacity: 10,
        refillRate: -1,
        interval: 1,
      });

    expect(create).toThrow("refillRate must be a positive integer");
  });

  test("throws when interval is invalid", () => {
    const create = () =>
      new TokenBucket(store, {
        capacity: 10,
        refillRate: 1,
        interval: 0,
      });

    expect(create).toThrow("interval must be a positive integer");
  });

  test("throws when keyPrefix is blank", () => {
    const create = () =>
      new TokenBucket(store, {
        capacity: 10,
        refillRate: 1,
        interval: 5,
        keyPrefix: "   ",
      });

    expect(create).toThrow("keyPrefix must be a non-empty string");
  });
});
