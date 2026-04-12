import TokenBucket from "../src/token";

describe('basic token bucket tests', () => {

   let bucket: TokenBucket;
   beforeEach(() => {
       bucket = new TokenBucket(10, 2, 10);
       jest.useFakeTimers();
   })

   test('should allow requests upto the maximum capacity', () => {
       expect(bucket.consume(5)).toBe(true);
       expect(bucket.consume(5)).toBe(true);
       expect(bucket.consume(1)).toBe(false);
   });

   test('should not allow consuming more tokens than available', () => {
       expect(bucket.consume(20)).toBe(false);
       expect(bucket.consume(10)).toBe(true);
       expect(bucket.consume(3)).toBe(false);
   });

   test('should refiill tokens after some time correctly', () => {

       expect(bucket.getTokens()).toBe(10);
       bucket.consume(10);
       expect(bucket.getTokens()).toBe(0);

       // now that i advanced the time by 35s
       // the bucket should have refilled (35/10) * 2 = floor(3.5) = 3 * 2 = 6 tokens 
       // so new token count should be 6
       jest.advanceTimersByTime(35000);
       expect(bucket.getTokens()).toBe(6);
   })
})
