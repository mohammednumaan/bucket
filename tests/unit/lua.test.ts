import redisClient from "../../src/redis";

beforeAll(async () => {
  await redisClient.flushall();
});

afterAll(async () => {
  await redisClient.quit();
});

describe("rate limiter - Lua script argument validation", () => {
  describe("capacity validation", () => {
    test("returns -1 sentinel when capacity is zero", async () => {
      const result = await redisClient.consumeToken("test-key", 0, 1, 5, 1);
      expect(result).toEqual([-1, 0, 0]);
    });

    test("returns -1 sentinel when capacity is negative", async () => {
      const result = await redisClient.consumeToken("test-key", -5, 1, 5, 1);
      expect(result).toEqual([-1, 0, 0]);
    });
  });

  describe("refillRate validation", () => {
    test("returns -1 sentinel when refillRate is zero", async () => {
      const result = await redisClient.consumeToken("test-key", 10, 0, 5, 1);
      expect(result).toEqual([-1, 0, 0]);
    });

    test("returns -1 sentinel when refillRate is negative", async () => {
      const result = await redisClient.consumeToken("test-key", 10, -3, 5, 1);
      expect(result).toEqual([-1, 0, 0]);
    });
  });

  describe("interval validation", () => {
    test("returns -1 sentinel when interval is zero", async () => {
      const result = await redisClient.consumeToken("test-key", 10, 1, 0, 1);
      expect(result).toEqual([-1, 0, 0]);
    });

    test("returns -1 sentinel when interval is negative", async () => {
      const result = await redisClient.consumeToken("test-key", 10, 1, -10, 1);
      expect(result).toEqual([-1, 0, 0]);
    });
  });

  describe("requested validation", () => {
    test("returns -1 sentinel when requested is negative", async () => {
      const result = await redisClient.consumeToken("test-key", 10, 1, 5, -1);
      expect(result).toEqual([-1, 0, 0]);
    });
  });

  describe("valid arguments", () => {
    test("proceeds normally when all args are valid", async () => {
      const result = await redisClient.consumeToken("test-key", 10, 1, 5, 1);
      expect(result[0]).not.toBe(-1);
    });
  });
});
