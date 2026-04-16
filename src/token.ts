export class Bucket {
    capacity: number;
    tokens: number;
    refillRate: number;
    interval: number;
    lastRefillTimestamp: number;
    lastUsedTimestamp: number;

    constructor(
        capacity: number,
        refillRate: number,
        interval: number,
        tokens?: number,
        lastRefillTimestamp?: number,
        lastUsedTimestamp?: number
    ) {
        this.capacity = capacity;
        this.tokens = tokens ?? capacity;
        this.refillRate = refillRate;
        this.interval = interval;
        this.lastRefillTimestamp = lastRefillTimestamp ?? Date.now();
        this.lastUsedTimestamp = lastUsedTimestamp ?? Date.now();
    }
} 

export default class TokenBucketManager{
    private static refill(bucket: Bucket) {
        const now = Date.now();
        const secondsElapsed = (now - bucket.lastRefillTimestamp) / 1000;


        if (secondsElapsed >= bucket.interval) {
            const intervalsCompleted = Math.floor(secondsElapsed / bucket.interval);
            const tokensToAdd = intervalsCompleted * bucket.refillRate;
            bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
            bucket.lastRefillTimestamp += intervalsCompleted * bucket.interval * 1000;
        }
    }

    public static consume(bucket: Bucket, tokens: number): boolean {
        TokenBucketManager.refill(bucket);

        if (bucket.tokens < tokens) {
            return false;
        }

        bucket.tokens -= tokens;
        bucket.lastUsedTimestamp = Date.now();
        return true;
    }

    public static toBucket(redisData: Record<string, string>): Bucket | null {
        if (Object.keys(redisData).length === 0) return null;

        return new Bucket(
            Number(redisData.capacity),
            Number(redisData.refillRate),
            Number(redisData.interval),
            Number(redisData.tokens),
            Number(redisData.lastRefillTimestamp),
            Number(redisData.lastUsedTimestamp)
        );
    }

    public static getLastRefill(bucket: Bucket): number {
        return bucket.lastRefillTimestamp;
    }

    public static getTokens(bucket: Bucket): number {
        TokenBucketManager.refill(bucket);
        return bucket.tokens;
    }

    public static getLastUsed(bucket: Bucket): number {
        return bucket.lastUsedTimestamp;
    }
}
