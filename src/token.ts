export default class TokenBucket {

    private capacity: number;
    private tokens: number;
    private refillRate: number;
    private interval: number;
    private lastRefillTimestamp: number;

    constructor(capacity: number, refillRate: number, interval: number) {
        this.capacity = capacity;
        this.tokens = capacity;
        this.refillRate = refillRate;
        this.interval = interval;
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

        if (secondsElapsed >= this.interval) {
            const intervalsCompleted = Math.floor(secondsElapsed / this.interval);
            const tokensToAdd = intervalsCompleted * this.refillRate;

            /*
             lets say:
             elapsed = 25
             interval = 10
             refillRate = 5
             itervalsCompleted = 2
             tokensToAdd = 2 * 5 = 10
             lastRefillTimestamp += (2 * 10 * 1000) = 20 seconds in milliseconds 
             we move the current timestamp to (refill * intervalCompleted) to avoid "partial"
             intervals, for example, in the above scenario, we still have 5 seconds left, which              is preserved and included the next time the refill is called
           */

            this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
            this.lastRefillTimestamp += intervalsCompleted * this.interval * 1000;
        }
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
