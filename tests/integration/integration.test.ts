import request from "supertest";
import app from "../../src/app.js";
import redisClient from "../../src/redis.js";

afterAll(async () => {
  await redisClient.flushall();
  await redisClient.quit();
});

describe("rate limiter integration", () => {
  beforeEach(async () => {
    await redisClient.flushall();
  });

  afterEach(async () => {
    await redisClient.flushall();
  });

  test("returns 400 when x-api-key is missing", async () => {
    const response = await request(app).get("/api/test");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "missing x-api-key header" });
  });

  test("allows requests with a valid x-api-key", async () => {
    const response = await request(app).get("/api/test").set("x-api-key", "user-a");

    expect(response.status).toBe(200);
    expect(response.body.message).toContain("Request successful!");
  });

  test("returns 429 after capacity is exhausted", async () => {
    const key = "throttle-user";

    for (let i = 0; i < 10; i += 1) {
      const ok = await request(app).get("/api/test").set("x-api-key", key);
      expect(ok.status).toBe(200);
    }

    const limited = await request(app).get("/api/test").set("x-api-key", key);

    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe("rate limit exceeded");
    expect(typeof limited.body.remaining).toBe("number");
    expect(limited.body.remaining).toBe(0);
  });

  test("refills tokens after the interval", async () => {
    const key = "refill-user";

    for (let i = 0; i < 10; i += 1) {
      await request(app).get("/api/test").set("x-api-key", key);
    }

    const limited = await request(app).get("/api/test").set("x-api-key", key);
    expect(limited.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 5100));

    const afterRefill = await request(app).get("/api/test").set("x-api-key", key);
    expect(afterRefill.status).toBe(200);
  }, 15000);

  test("tracks limits independently for different api keys", async () => {
    const keyA = "user-a";
    const keyB = "user-b";

    for (let i = 0; i < 10; i += 1) {
      await request(app).get("/api/test").set("x-api-key", keyA);
    }

    const keyALimited = await request(app).get("/api/test").set("x-api-key", keyA);
    const keyBOk = await request(app).get("/api/test").set("x-api-key", keyB);

    expect(keyALimited.status).toBe(429);
    expect(keyBOk.status).toBe(200);
  });

  test("handles concurrent requests atomically", async () => {
    const key = "concurrent-user";
    const total = 50;

    const responses = await Promise.all(
      Array.from({ length: total }, () =>
        request(app).get("/api/test").set("x-api-key", key)
      )
    );

    const allowed = responses.filter((response) => response.status === 200).length;
    const limited = responses.filter((response) => response.status === 429).length;

    expect(allowed).toBe(10);
    expect(limited).toBe(total - 10);
  }, 15000);

  test("sets a TTL on the bucket key so it expires when fully refilled", async () => {
    const key = "expiry-test-user";

    await request(app).get("/api/test").set("x-api-key", key);

    const ttl = await redisClient.ttl(`rl:${key}`);

    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(26);
  });

  test("removes the token from Redis once TTL passes", async () => {
    const key = "expiry-deletion-test";

    await request(app).get("/api/test").set("x-api-key", key);

    let exists = await redisClient.exists(`rl:${key}`);
    expect(exists).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 27000));

    exists = await redisClient.exists(`rl:${key}`);
    expect(exists).toBe(0); 
  }, 35000);
});
