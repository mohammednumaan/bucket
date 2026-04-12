import TokenBucket from "./token";

export default class RateLimiter {
    private buckets: Map<string, TokenBucket> = new Map();
    private capacity: number;
    private refillRate: number;
    private interval: number;

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
}
