import TokenBucket from "./token";

export default class RateLimiter {

    private buckets: Map<string, TokenBucket> = new Map();
    private capacity: number;
    private refillRate: number;
    private interval: number;
    private cleanUpInterval: number = 60 * 5;

    constructor(capacity: number, refillRate: number, interval: number){
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.interval = interval;
    }

    public attemptRequest(key: string, tokens: number = 1): boolean {
        let bucket = this.buckets.get(key);

        if (!bucket){
            bucket = new TokenBucket(this.capacity, this.refillRate, this.interval);
            this.buckets.set(key, bucket);
        }

        return bucket.consume(tokens);
    }

    public getBucket(key: string): TokenBucket | null {
        return this.buckets.get(key) || null;
    }

    // a simple cleanup function (TTL-based) that removes buckets after 5 minutes
    // of inactivity to prevent memory leaks
    public cleanup(): void {
        const now = Date.now();
        for (const [key, bucket] of this.buckets){
            const timeElapsedSeconds = (now - bucket.getLastUsed()) / 1000;
            if (timeElapsedSeconds > this.cleanUpInterval){
                this.buckets.delete(key);
            }
        }
    }
}
