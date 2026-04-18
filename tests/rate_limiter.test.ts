import Redis from "ioredis";
import RateLimiter from "../src/rate_limiter.js";


describe("rate limiter", () => {
  const key = "192.168.1.1";
  const otherKey = "192.168.1.2";

  let client: Redis;
  let rateLimiter: RateLimiter;

  beforeEach(async () => {
    client = new Redis();
    await client.flushall();
    rateLimiter = new RateLimiter(client, 10, 2, 5);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("allows requests until bucket is exhausted", async () => {
    await expect(rateLimiter.attemptRequest(key, 10)).resolves.toBe(true);
    await expect(rateLimiter.attemptRequest(key, 1)).resolves.toBe(false);
  });

  test("keeps separate buckets per key", async () => {
    await expect(rateLimiter.attemptRequest(key, 10)).resolves.toBe(true);
    await expect(rateLimiter.attemptRequest(otherKey, 10)).resolves.toBe(true);

    await expect(rateLimiter.attemptRequest(key, 1)).resolves.toBe(false);
    await expect(rateLimiter.attemptRequest(otherKey, 1)).resolves.toBe(false);
  });

  test("refills tokens after the configured interval", async () => {
    jest.useFakeTimers();

    await expect(rateLimiter.attemptRequest(key, 10)).resolves.toBe(true);
    await expect(rateLimiter.attemptRequest(key, 1)).resolves.toBe(false);

    jest.advanceTimersByTime(5000);

    await expect(rateLimiter.attemptRequest(key, 2)).resolves.toBe(true);
    await expect(rateLimiter.attemptRequest(key, 1)).resolves.toBe(false);
  });

  test("persists state across limiter instances", async () => {
    jest.useFakeTimers();
    await expect(rateLimiter.attemptRequest(key, 7)).resolves.toBe(true);
    const anotherLimiter = new RateLimiter(client, 10, 2, 5);

    await expect(anotherLimiter.attemptRequest(key, 4)).resolves.toBe(false);
    await expect(anotherLimiter.attemptRequest(key, 3)).resolves.toBe(true);

    jest.advanceTimersByTime(5000);
    await expect(anotherLimiter.attemptRequest(key, 2)).resolves.toBe(true);
    await expect(anotherLimiter.attemptRequest(key, 1)).resolves.toBe(false);
    await expect(rateLimiter.attemptRequest(key, 1)).resolves.toBe(false);

  });
});
