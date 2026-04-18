import RateLimiter from "../src/rate_limiter.js";
import Redis from "ioredis";
import type { RedisTokenBucketClient } from "../src/redis.js";

describe("rate limiter defaults", () => {
  let client: RedisTokenBucketClient;

  beforeEach(async () => {
    client = new Redis() as unknown as RedisTokenBucketClient;
    await client.flushall();
  });

  afterEach(async () => {
    await client.quit();
  });

  test("uses one token when request size is omitted", async () => {
    const consumeToken = jest.fn().mockResolvedValue([1, 9]);
    client.consumeToken = consumeToken;
    const rateLimiter = new RateLimiter(client, 10, 2, 5);

    await expect(rateLimiter.attemptRequest("192.168.1.1")).resolves.toBe(true);

    expect(consumeToken).toHaveBeenCalledWith("rate_limiter:192.168.1.1", 10, 2, 5, 1);
  });

  test("uses the provided request size", async () => {
    const consumeToken = jest.fn().mockResolvedValue([1, 7]);
    client.consumeToken = consumeToken;
    const rateLimiter = new RateLimiter(client, 10, 2, 5);

    await expect(rateLimiter.attemptRequest("192.168.1.1", 3)).resolves.toBe(true);

    expect(consumeToken).toHaveBeenCalledWith("rate_limiter:192.168.1.1", 10, 2, 5, 3);
  });
});
