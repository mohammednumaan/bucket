import { Redis } from 'ioredis';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

export interface RateLimiterRedis extends Redis {
    consumeToken(
        key: string,
        capacity: number,
        refillRate: number,
        intervalSeconds: number,
        requested: number
    ): Promise<[number, number]>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.join(__dirname, '..', 'lua', 'redis.lua');
const LUA_SCRIPT = fs.readFileSync(scriptPath, 'utf-8');

const redisClient = new Redis({
    host: 'redis',
    port: 6379
});

redisClient.defineCommand('consumeToken', {
    numberOfKeys: 1,
    lua: LUA_SCRIPT
})
export default redisClient as RateLimiterRedis;
