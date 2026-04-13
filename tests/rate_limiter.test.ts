import RateLimiter from '../src/rate_limiter'

describe('basic rate limiter tests', () => {
    let rl: RateLimiter;
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.2";

    beforeEach(() => {
        rl = new RateLimiter(10, 2, 5);
        jest.useFakeTimers();
    })

    test('should return null for non-existent buckets', () => {
        const nonExistentIp = "192.168.1.3";
        expect(rl.getBucket(nonExistentIp)).toBeNull();
    });

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
        expect(rl.attemptRequest(ip2, 10)).toBe(true);

        expect(rl.getBucket(ip1)!.getTokens()).toBe(2);
        expect(rl.getBucket(ip2)!.getTokens()).toBe(0);

        // secondsElapsed = 5
        // intervalsComplete = 5 / 5 = 1
        // tokensToAdd = 1 * 2 = 2
        jest.advanceTimersByTime(5000);
        expect(rl.getBucket(ip1)!.getTokens()).toBe(4);
        expect(rl.getBucket(ip2)!.getTokens()).toBe(2);

        jest.advanceTimersByTime(10000);
        expect(rl.getBucket(ip1)!.getTokens()).toBe(8);
        expect(rl.getBucket(ip2)!.getTokens()).toBe(6);
    });

    test('should cleanup inactive buckets correctly', () => {
        expect(rl.attemptRequest(ip1)).toBeTruthy();
        expect(rl.attemptRequest(ip2)).toBeTruthy();

        jest.advanceTimersByTime(60 * 1000);
        rl.cleanup();
        expect(rl.getBucket(ip1)).toBeTruthy();
        expect(rl.getBucket(ip2)).toBeTruthy();

        jest.advanceTimersByTime(60 * 3 * 1000);
        rl.cleanup();
        expect(rl.getBucket(ip1)).toBeTruthy();
        expect(rl.getBucket(ip2)).toBeTruthy();

        jest.advanceTimersByTime(60 * 1000);
        rl.cleanup();
        expect(rl.getBucket(ip1)).toBeTruthy();
        expect(rl.getBucket(ip2)).toBeTruthy();

        jest.advanceTimersByTime(60 * 1000);
        rl.cleanup();
        expect(rl.getBucket(ip1)).toBeNull();
        expect(rl.getBucket(ip2)).toBeNull();
 
    });
})
