import TokenBucket from "../src/token";

describe('basic token bucket tests', () => {

   let bucket: TokenBucket;
   beforeEach(() => {
       bucket = new TokenBucket(5, 1);
       jest.useFakeTimers();
   })

   test('should allow requests upto the maximum capacity', () => {
       expect(bucket.consume(3)).toBe(true);
       expect(bucket.consume(2)).toBe(true);
       expect(bucket.consume(1)).toBe(false);
   });

   test("should refiill tokens after some time", () => {

       // this is the initial state of the bucket
       expect(bucket.getTokens()).toBe(5);
       expect(bucket.consume(5)).toBe(true);

       // then i consume some tokens and the bucket should be empty
       expect(bucket.getTokens()).toBe(0);

       // then i wait for 1s and the bucket should have 1 token
       // since the refill rate is 1 token per second
       jest.advanceTimersByTime(1000);
       expect(bucket.getTokens()).toBe(1);

       jest.advanceTimersByTime(4000);
       expect(bucket.getTokens()).toBe(5);

       // now it should consume all tokens
       expect(bucket.consume(5)).toBe(true);
       expect(bucket.consume(1)).toBe(false);
   })
})

