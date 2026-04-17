import { Redis } from 'ioredis';
const redisClient = new Redis({
    host: 'redis'
});
export default redisClient;
