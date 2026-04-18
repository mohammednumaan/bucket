import { Redis } from "ioredis";
import fs from "fs";
import path from "path";

export interface RedisTokenBucketClient extends Redis {
  consumeToken(
    key: string,
    capacity: number,
    refillRate: number,
    intervalSeconds: number,
    requested: number
  ): Promise<[number, number, number]>;
}

const scriptPath = path.resolve(process.cwd(), "lua", "redis.lua");
const LUA_SCRIPT = fs.readFileSync(scriptPath, "utf-8");

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

redisClient.defineCommand("consumeToken", {
  numberOfKeys: 1,
  lua: LUA_SCRIPT,
});

export default redisClient as RedisTokenBucketClient;
