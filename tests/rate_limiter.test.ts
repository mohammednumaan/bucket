import RateLimiter from '../src/rate_limiter'

describe('basic rate limiter tests', () => {
    let rl: RateLimiter;
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.2";
    beforeEach(() => {
        rl = new RateLimiter(10, 2, 5);
        jest.useFakeTimers();
    })

    test('should add new ips to the rate limiter on request', () => {
        expect(rl.attemptRequest(ip1)).toBe(true);
        expect(rl.getBucket(ip1)!.getTokens()).toBe(9);

        expect(rl.attemptRequest(ip2)).toBe(true);
        expect(rl.getBucket(ip2)!.getTokens()).toBe(9);


        expect(rl.attemptRequest(ip1, 9)).toBe(true);
        expect(rl.getBucket(ip1)!.getTokens()).toBe(0);

        expect(rl.attemptRequest(ip2, 9)).toBe(true);
        expect(rl.getBucket(ip2)!.getTokens()).toBe(0);
    });


    test('should refill tokens correctly after the refill interval', () => {
        expect(rl.attemptRequest(ip1, 8)).toBe(true);
        expect(rl.getBucket(ip1)!.getTokens()).toBe(2);

        // secondsElapsed = 5
        // intervalsComplete = 5 / 5 = 1
        // tokensToAdd = 1 * 2 = 2
        jest.advanceTimersByTime(5000);
        expect(rl.getBucket(ip1)!.getTokens()).toBe(4);

        jest.advanceTimersByTime(5000);
        expect(rl.getBucket(ip1)!.getTokens()).toBe(6);
    });
})
