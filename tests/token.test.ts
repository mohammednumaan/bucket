import TokenBucketManager, { Bucket } from "../src/token";

describe('basic token bucket tests', () => {

   let bucket: Bucket;
   beforeEach(() => {
       bucket = new Bucket(10, 2, 10);
       jest.useFakeTimers();
    })

   test('should allow requests upto the maximum capacity', () => {
       expect(TokenBucketManager.consume(bucket, 5)).toBe(true);
       expect(TokenBucketManager.consume(bucket, 5)).toBe(true);
       expect(TokenBucketManager.consume(bucket, 1)).toBe(false);
    });

   test('should not allow consuming more tokens than available', () => {
       expect(TokenBucketManager.consume(bucket, 20)).toBe(false);
       expect(TokenBucketManager.consume(bucket, 10)).toBe(true);
       expect(TokenBucketManager.consume(bucket, 3)).toBe(false);
    });

   test('should refill tokens after some time correctly', () => {

       expect(TokenBucketManager.getTokens(bucket)).toBe(10);
       TokenBucketManager.consume(bucket, 10);
       expect(TokenBucketManager.getTokens(bucket)).toBe(0);

       // now that i advanced the time by 35s
       // the bucket should have refilled (35/10) * 2 = floor(3.5) = 3 * 2 = 6 tokens 
       // so new token count should be 6
       jest.advanceTimersByTime(35000);
       expect(TokenBucketManager.getTokens(bucket)).toBe(6);
        
       expect(TokenBucketManager.consume(bucket, 6)).toBe(true);
       expect(TokenBucketManager.getTokens(bucket)).toBe(0);
    })
})
