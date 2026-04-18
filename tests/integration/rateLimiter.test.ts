import request from "supertest";
import app from "../../src/app.js";
import redisClient from "../../src/redis.js";

describe("rate limiter - lua edge cases", () => {
    beforeEach(async () => {
        await redisClient.flushall();
    });

    afterAll(async () => {
        await redisClient.flushall();
        await redisClient.quit();
    });

    test("denies a request that asks for more tokens than capacity", async () => {
        const result = await redisClient.consumeToken("rl:over-request-user", 10, 2, 5, 20);
        const [allowed, remaining] = result;

        expect(allowed).toBe(0);
        expect(remaining).toBe(10);
    });

    test("does not refill mid-interval (partial time elapsed)", async () => {
        const key = "partial-refill-user";

        for (let i = 0; i < 10; i++) {
            await request(app).get("/api/test").set("x-api-key", key);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));

        const response = await request(app).get("/api/test").set("x-api-key", key);
        expect(response.status).toBe(429);
    }, 15000);

    test("refills in discrete interval steps, not continuously", async () => {
        const key = "discrete-refill-user";

        for (let i = 0; i < 10; i++) {
            await request(app).get("/api/test").set("x-api-key", key);
        }

        await new Promise((resolve) => setTimeout(resolve, 5100));

        const first = await request(app).get("/api/test").set("x-api-key", key);
        const second = await request(app).get("/api/test").set("x-api-key", key);
        const third = await request(app).get("/api/test").set("x-api-key", key);

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(third.status).toBe(429);
    }, 20000);

    test("new key initialises to full capacity on first request", async () => {
        const key = "fresh-key-user";

        const response = await request(app).get("/api/test").set("x-api-key", key);
        expect(response.status).toBe(200);
    });

    test("returns Retry-After and rate limit headers on 429", async () => {
        const key = "headers-test-user";

        for (let i = 0; i < 10; i++) {
            await request(app).get("/api/test").set("x-api-key", key);
        }

        const response = await request(app).get("/api/test").set("x-api-key", key);

        expect(response.status).toBe(429);
        expect(response.headers["x-ratelimit-limit"]).toBe("10");
        expect(response.headers["x-ratelimit-remaining"]).toBe("0");

        const retryAfter = parseInt(response.headers["retry-after"], 10);
        expect(retryAfter).toBeGreaterThanOrEqual(1);
        expect(retryAfter).toBeLessThanOrEqual(5);
    });
});
