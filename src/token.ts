export default class TokenBucket {

    private capacity: number;
    private tokens: number;
    private refillRate: number;
    private lastRefillTimestamp: number;

    constructor(capacity: number, refillRate: number) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.refillRate = refillRate;
        this.lastRefillTimestamp = Date.now();
    }

    // this is a very interesting problem to solve
    // i need to choose a refill strategy properly:
    // 1. interval-based (similar to fixed-size window algo)
    // 2. greedy-based (refill tokens as soon as possible)
    // the refill rate is tps (tokens-per-second)
    private refill() {
        const now = Date.now();
        const secondsElapsed = (now - this.lastRefillTimestamp) / 1000;

        const tokensToAdd = (secondsElapsed * this.refillRate);
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefillTimestamp = now;

    }

    public consume(tokens: number): boolean {
        this.refill();

        if (this.tokens < tokens) {
            return false;
        }

        this.tokens -= tokens;
        return true;
    }

    public getTokens(): number {
        this.refill();
        return this.tokens;
    }
}
