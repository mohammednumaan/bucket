# Flaws and Limitations

This document outlines known issues, limitations, and design weaknesses in the distributed rate limiter project.

## Critical Issues

### 1. No Connection Retry Handling

The Redis client configuration (`src/redis.ts`) lacks proper retry logic:

```typescript
const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});
```

**Problem**: When Redis becomes unavailable, requests fail immediately with no graceful degradation. There is no circuit breaker pattern or fallback behavior.

### 3. Unbounded Memory Growth

The system uses Redis hashes (`HMGET`/`HMSET`) with TTL-based cleanup, but:

- No limit on number of unique API keys
- No cleanup mechanism for stale keys that never expire due to ongoing traffic
- Redis memory can grow unbounded with large numbers of unique clients

## Design Limitations

### 4. Fixed Configuration for All Clients

All clients share the same rate limit configuration:

```typescript
const rateLimiter = new RateLimiter(redisClient, {
  capacity: 10,
  refillRate: 2,
  interval: 5,
});
```

**Problem**: Cannot differentiate between client tiers (free vs premium). Requires code changes to modify limits per client.

### 5. No API Key Validation

The middleware extracts `x-api-key` directly without validation:

```typescript
const apiKey = req.headers["x-api-key"] as string;
```

**Problem**: 
- Empty or malformed keys create separate buckets
- No way to revoke compromised keys
- No authentication behind rate limiting

### 6. Missing Distributed Lock for First Request

When a new key initializes, multiple concurrent requests may see `nil` bucket state and all initialize independently:

```lua
if not tokens then
    tokens = capacity
    lastRefillTimestamp = nowMs
```

**Problem**: While Redis executes atomically, multiple script executions in quick succession can still cause temporary inconsistencies.

### 7. Hardcoded Redis Key Prefix

The key prefix is hardcoded in multiple places without centralized management:

```typescript
const redisKey = `${this.keyPrefix}:${key}`;
```

**Problem**: No namespacing between environments (dev/staging/prod). Potential key collisions.

## Implementation Issues

### 8. No Input Validation

The Lua script accepts any input without bounds checking:

```lua
local capacity = tonumber(ARGV[1])
local requested = tonumber(ARGV[4])
```

**Problem**: 
- Negative values cause unexpected behavior
- Values exceeding Redis integer limits cause errors
- No sanitization of malformed inputs

### 9. Error Handling Gaps

Errors in the Lua script fall through without detailed logging:

```lua
return { allowed, tokens, retryAfter }
```

**Problem**: Failed script executions return unexpected results. No error differentiation between "rate limited" and "system error".

### 10. Synchronous Redis Calls

The TypeScript implementation uses synchronous-style calls:

```typescript
const [allowed, remaining, retryAfter] = await this.store.consumeToken(
  redisKey, this.capacity, this.refillRate, this.interval, requested
);
```

**Problem**: Every request blocks on Redis. No request batching or pipeline optimization. High Redis latency directly impacts response times.

### 11. No Lua Input Validation

The Lua script accepts parameters without bounds checking:

```lua
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local interval = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
```

**Problem**:
- Negative or zero values cause unexpected behavior or division by zero
- Extremely large values can cause overflow or memory issues
- No validation that parameters are valid numbers before use

### 12. No API Key Validation

The middleware extracts API keys without validation:

```typescript
const apiKey = req.headers["x-api-key"] as string;
```

**Problem**:
- Empty, null, or whitespace-only keys create separate buckets
- No format validation (e.g., expected key length, character set)
- No check for key existence in a valid keys store

## Missing Features

### 14. No Metrics or Observability

- No Prometheus metrics exposed
- No distributed tracing integration
- No logging of rate limit decisions for debugging

### 15. No Rate Limit Headers on Error

When Redis fails, no headers sent to client:

```typescript
if (!allowed) {
  res.set("Retry-After", retryAfter);
  return res.status(429).json({ error: "Rate limited" });
}
```

**Problem**: Clients cannot distinguish between "rate limited" and "Redis down" scenarios.

### 16. No Sliding Window Support

Only discrete token bucket available:

```lua
if (secondsElapsed >= interval) then
```

**Problem**: Cannot implement smoother rate limiting with sliding windows. Users experience hard cutoffs at interval boundaries.

### 21. No Bulk Key Management

No way to:

- List all active API keys
- Manually reset a specific client's bucket
- View remaining tokens for a client

### 18. No Health Check Endpoint

No dedicated endpoint for load balancer health checks:

```typescript
app.get("/api/test", useRateLimiterMiddleware(rateLimiter), handler);
```

**Problem**: Health checks consume rate limit tokens. No way to distinguish health checks from regular traffic.

## Testing Gaps

### 19. No Unit Tests for Lua Script

The Lua script is tested only through integration tests:

- No isolated script testing
- No boundary value tests
- No negative input tests

### 20. No Failure Mode Testing

Tests don't verify behavior when:

- Redis connection drops mid-request
- Lua script returns error
- Network timeout occurs

### 18. No Load Testing Results

Documentation shows load testing code but no actual results:

```typescript
console.assert(allowed === 10, "Expected exactly 10 allowed requests");
```

**Problem**: No performance benchmarks or stress test data. Unknown throughput limits.

## Deployment Concerns

### 19. Single Point of Failure

The architecture assumes single Redis:

```yaml
redis:
  image: redis:alpine
```

**Problem**: No Redis Sentinel or Cluster. Redis downtime affects all servers.

### 20. No Graceful Shutdown

Server doesn't drain connections on shutdown:

```typescript
const server = app.listen(PORT);
```

**Problem**: In-flight requests fail when containers restart. No connection draining.

### 21. Environment Configuration

Configuration via environment variables but no validation:

```typescript
const PORT = Number(process.env.PORT ?? 3000);
```

**Problem**: Invalid values (negative port, NaN) cause silent failures or crashes.

## Summary

| Category | Count |
|----------|-------|
| Critical Issues | 2 |
| Design Limitations | 4 |
| Implementation Issues | 6 |
| Missing Features | 8 |
| Testing Gaps | 3 |
| Deployment Concerns | 3 |

This project is a proof-of-concept implementation. Production use would require addressing at minimum the critical issues and adding proper observability.