import request from "supertest";
import app from "../../src/app.js";
import redisClient from "../../src/redis.js";

beforeEach(async () => {
  await redisClient.flushall();
});

afterEach(async () => {
  await redisClient.flushall();
  await redisClient.quit();
  jest.restoreAllMocks();
});

describe("Error handler middleware", () => {
  test("returns 500 for unexpected errors", async () => {
    jest.spyOn(redisClient, "consumeToken").mockRejectedValueOnce(new Error("Redis connection failed"));

    const response = await request(app)
      .get("/api/test")
      .set("x-api-key", "error-key");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "internal server error" });
  });
});
