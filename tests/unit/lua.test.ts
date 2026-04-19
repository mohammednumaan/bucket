import redisClient from "../../src/redis";

async function expectLuaValidationSentinel(
  key: string,
  capacity: number,
  refillRate: number,
  interval: number,
  requested: number
) {
  const result = await redisClient.consumeToken(
    key,
    capacity,
    refillRate,
    interval,
    requested
  );
  expect(result).toEqual([-1, 0, 0]);
}

beforeEach(async () => {
  await redisClient.flushall();
});

afterAll(async () => {
  await redisClient.quit();
});

describe("rate limiter - Lua script argument validation", () => {
  describe("capacity validation", () => {
    test("returns -1 sentinel when capacity is zero", async () => {
      await expectLuaValidationSentinel("lua:cap-zero", 0, 1, 5, 1);
    });

    test("returns -1 sentinel when capacity is negative", async () => {
      await expectLuaValidationSentinel("lua:cap-negative", -5, 1, 5, 1);
    });
  });

  describe("refillRate validation", () => {
    test("returns -1 sentinel when refillRate is zero", async () => {
      await expectLuaValidationSentinel("lua:refill-zero", 10, 0, 5, 1);
    });

    test("returns -1 sentinel when refillRate is negative", async () => {
      await expectLuaValidationSentinel("lua:refill-negative", 10, -3, 5, 1);
    });
  });

  describe("interval validation", () => {
    test("returns -1 sentinel when interval is zero", async () => {
      await expectLuaValidationSentinel("lua:interval-zero", 10, 1, 0, 1);
    });

    test("returns -1 sentinel when interval is negative", async () => {
      await expectLuaValidationSentinel("lua:interval-negative", 10, 1, -10, 1);
    });
  });

  describe("requested validation", () => {
    test("returns -1 sentinel when requested is negative", async () => {
      await expectLuaValidationSentinel("lua:req-negative", 10, 1, 5, -1);
    });

    test("returns -1 sentinel when requested is not an integer", async () => {
      await expectLuaValidationSentinel("lua:req-float", 10, 1, 5, 1.5);
    });
  });

  describe("valid arguments", () => {
    test("proceeds normally when all args are valid", async () => {
      const result = await redisClient.consumeToken("lua:valid", 10, 1, 5, 1);
      expect(result[0]).not.toBe(-1);
    });

    test("allows zero requested tokens without sentinel", async () => {
      const result = await redisClient.consumeToken("lua:zero-request", 10, 1, 5, 0);
      expect(result[0]).not.toBe(-1);
      expect(result[1]).toBe(10);
    });
  });
});
