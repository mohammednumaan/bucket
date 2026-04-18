# Distributed Rate Limiter

A production-ready distributed rate limiter implementing the Token Bucket algorithm, built in TypeScript with Redis for atomic state management.

## Overview

This repository provides a horizontally scalable rate limiting solution designed for distributed systems. Multiple server instances share a common Redis backend, ensuring consistent rate limit enforcement across all nodes without coordination issues.

## System Architecture

### High-Level Architecture

```
                                    ┌─────────────────────────────────────┐
                                    │           Client Requests            │
                                    │     (x-api-key header required)     │
                                    └─────────────────────────────────────┘
                                                 │
                                                 ▼
                                    ┌─────────────────────────────────────┐
                                    │           nginx Load Balancer         │
                                    │        (Round-robin distribution)    │
                                    └─────────────────────────────────────┘
                                                 │
           ┌──────────────────────────────────────┼──────────────────────────────────────┐
           │                                      │                                      │
           ▼                                      ▼                                      ▼
┌─────────────────────┐          ┌─────────────────────┐          ┌─────────────────────┐
│    Server Instance 1 │          │    Server Instance 2 │          │    Server Instance 3 │
│   (Express + TS)    │          │   (Express + TS)    │          │   (Express + TS)    │
│                     │          │                     │          │                     │
│  - Rate Limiter     │          │  - Rate Limiter     │          │  - Rate Limiter     │
│  - Middleware      │          │  - Middleware      │          │  - Middleware      │
└─────────────────────┘          └─────────────────────┘          └─────────────────────┘
           │                                      │                                      │
           └──────────────────────────────────────┼──────────────────────────────────────┘
                                                 │
                                                 ▼
                                    ┌─────────────────────────────────────┐
                                    │              Redis                   │
                                    │    (Single Source of Truth)          │
                                    │                                     │
                                    │  - Lua Script (Atomic Operations)   │
                                    │  - Key-Value State (HMGET/HMSET)    │
                                    │  - TTL-based Cleanup               │
                                    └─────────────────────────────────────┘
```

### Distributed Design Principles

The system achieves distributed rate limiting through three key architectural decisions:

1. **Shared State via Redis**: All server instances connect to the same Redis instance, using it as a centralized state store. Each API key's bucket state (tokens remaining, last refill timestamp) is stored in Redis hashes.

2. **Atomic Lua Scripts**: The core token bucket algorithm runs entirely within Redis using a Lua script. Redis executes Lua scripts atomically, eliminating race conditions that would otherwise occur when multiple servers attempt to modify the same bucket simultaneously.

3. **Wall-Clock Time via Redis TIME()**: Instead of relying on server local time (which may differ across instances), the Lua script uses `redis.call('TIME')` to obtain the current wall-clock time. This ensures consistent token refill calculations regardless of which server handles the request.

## Core Architecture

### Project Structure

```
bucket/
├── src/
│   ├── app.ts                    # Express application entry point
│   ├── redis.ts                 # Redis client configuration
│   ├── rate_limiter/
│   │   ├── rateLimiter.ts       # Public API wrapper
│   │   └── tokenBucket.ts       # Token bucket logic
│   ├── middleware/
│   │   ├── rateLimiter.ts       # HTTP middleware
│   │   └── errorHandler.ts      # Error handling middleware
│   └── index.ts                 # Server bootstrap
├── lua/
│   └── redis.lua                # Token bucket algorithm (Redis-side)
├── compose.yml                  # Docker Compose for distributed setup
├── nginx/
│   └── nginx.conf               # Load balancer configuration
├── tests/
│   └── integration/             # Integration test suites
└── docs/
    └── rate-limiter.md          # This documentation
```

### Component Interactions

The following sequence diagram illustrates how a request flows through the system:

```
Client          nginx         Server          RateLimiter      TokenBucket      Redis
 │                │            │                │                │            │
 │──GET /api─────▶│──GET /api─▶│                │                │            │
 │                │            │──x-api-key────▶│                │            │
 │                │            │                │                │            │
 │                │            │                │──attemptRequest()──▶│         │
 │                │            │                │                │──consumeToken()──▶HMSET/
 │                │            │                │                │     HMGET    │
 │                │            │                │                │            │
 │                │            │                │◀──result───────│◀──result─────│
 │                │            │                │                │            │
 │                │◀──200 OK──│◀──200 OK──────│                │            │
 │◀──200 OK───────│            │                │                │            │
```

### Core Components

#### 1. Express Application (`src/app.ts`)

The main entry point that configures and wires together all components:

```typescript
const rateLimiter = new RateLimiter(redisClient, {
  capacity: 10,      // Maximum tokens in bucket
  refillRate: 2,      // Tokens added per interval
  interval: 5,        // Refill interval in seconds
  keyPrefix: "rl",     // Redis key prefix
});

app.get("/api/test", useRateLimiterMiddleware(rateLimiter), handler);
```

#### 2. Rate Limiter API (`src/rate_limiter/rateLimiter.ts`)

The public-facing API that consumers use to check rate limits:

```typescript
export default class RateLimiter {
  async attemptRequest(key: string, tokens: number = 1) {
    return await this.bucket.consume(key, tokens);
  }
}
```

Returns `{ allowed: 0|1, remaining: number, retryAfter: number }`.

#### 3. Token Bucket Implementation (`src/rate_limiter/tokenBucket.ts`)

Wraps the Redis client and constructs the proper key for state storage:

```typescript
async consume(key: string, requested: number = 1) {
  const redisKey = `${this.keyPrefix}:${key}`;
  const [allowed, remaining, retryAfter] = await this.store.consumeToken(
    redisKey, this.capacity, this.refillRate, this.interval, requested
  );
  return { allowed, remaining, retryAfter };
}
```

#### 4. HTTP Middleware (`src/middleware/rateLimiter.ts`)

Integrates rate limiting into the Express request pipeline:

- Extracts `x-api-key` header for identification
- Sets standard rate limit headers
- Returns appropriate HTTP status codes (401, 429)

#### 5. Redis Client (`src/redis.ts`)

Configures ioredis client with Lua script support:

```typescript
const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,  // Required for Lua scripts
  enableReadyCheck: true,
});
```

Loads the `consumeToken` Lua command on initialization.

## Algorithm Implementation

### Token Bucket Algorithm

The Token Bucket algorithm is a rate limiting technique that allows bursts of traffic up to a maximum capacity while enforcing a sustained average rate over time.

#### Core Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Token Bucket                                    │
│                                                                     │
│   Output: ──▶ Request ──▶ Request ──▶ Request ──▶ Request          │
│                                                                     │
│   Bucket:    [▓▓▓▓▓▓▓▓░░]    [▓▓▓▓░░░░░]    [▓▓░░░░░░]         │
│              8 tokens      4 tokens         2 tokens                │
│                                                                     │
│   Refill:  +2 tokens every 5 seconds                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Algorithm Characteristics

| Property | Description |
|----------|-------------|
| **Burst Allowance** | Up to `capacity` requests can be made instantly |
| **Sustained Rate** | Average rate limited to `refillRate / interval` |
| **Smooth Depletion** | Tokens consumed gradually, allowing bursts followed by cooldown |
| **Fairness** | Each unique key (API client) gets independent bucket |

### Lua Script Analysis (`lua/redis.lua`)

The complete algorithm runs atomically in Redis. Here's a line-by-line breakdown:

#### Step 1: Input Parameters (Lines 1-5)

```lua
local key = KEYS[1]           -- Redis key for this bucket
local capacity = tonumber(ARGV[1])   -- Maximum tokens
local refillRate = tonumber(ARGV[2])  -- Tokens added per interval
local interval = tonumber(ARGV[3])    -- Refill interval in seconds
local requested = tonumber(ARGV[4])   -- Tokens requested
```

#### Step 2: Time Calculation (Lines 7-9)

```lua
local intervalMs = interval * 1000
local time = redis.call('TIME')
local nowMs = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)
```

Uses Redis's `TIME()` command which returns `[seconds, microseconds]`. This provides wall-clock time from the Redis server, ensuring consistency across all server instances regardless of their local clock differences.

#### Step 3: Bucket State Retrieval (Lines 11-13)

```lua
local bucket = redis.call('HMGET', key, 'tokens', 'lastRefillTimestamp')
local tokens = tonumber(bucket[1])
local lastRefillTimestamp = tonumber(bucket[2])
```

Uses `HMGET` to retrieve both values atomically in a single Redis round-trip.

#### Step 4: New Bucket Initialization (Lines 15-17)

```lua
if not tokens then
    tokens = capacity
    lastRefillTimestamp = nowMs
```

For new API keys, initialize with full capacity and current timestamp.

#### Step 5: Refill Calculation (Lines 20-27)

```lua
local secondsElapsed = (nowMs - lastRefillTimestamp) / 1000;
if (secondsElapsed >= interval) then
    local intervalsCompleted = math.floor(secondsElapsed / interval)
    local tokensToAdd = intervalsCompleted * refillRate
    tokens = math.min(tokens + tokensToAdd, capacity)
    lastRefillTimestamp = lastRefillTimestamp + (intervalsCompleted * intervalMs)
end
```

Key observations:
- Uses `math.floor` for discrete interval counting (no partial refills)
- Caps tokens at `capacity` using `math.min`
- Advances `lastRefillTimestamp` to account for claimed time

#### Step 6: Consumption Check (Lines 30-34)

```lua
local allowed = 0
if tokens >= requested then
    allowed = 1
    tokens = tokens - requested
end
```

Simple comparison: if sufficient tokens available, allow the request and deduct tokens.

#### Step 7: State Persistence (Line 36)

```lua
redis.call('HMSET', key, 'tokens', tokens, 'lastRefillTimestamp', lastRefillTimestamp, 'lastUsedTimestamp', nowMs)
```

Persists updated state atomically using `HMSET`.

#### Step 8: TTL Management (Lines 38-39)

```lua
local ttl = math.ceil((capacity / refillRate) * interval) + 1
redis.call('EXPIRE', key, ttl)
```

Sets expiration to allow automatic cleanup:
- Full cycle time: `capacity / refillRate * interval` seconds
- Adds 1 second buffer for clock precision
- Keys auto-delete when unused

#### Step 9: Retry-After Calculation (Lines 41-48)

```lua
if allowed == 0 then
    local needed = requested - tokens
    local intervalsNeeded = math.ceil(needed / refillRate)
    local resetMs = lastRefillTimestamp + (intervalsNeeded * intervalMs)
    local retryAfter = math.ceil((resetMs - nowMs) / 1000)
    return { allowed, tokens, retryAfter }
end
```

When rate limited, calculates seconds until next token available.

## Design Decisions and Tradeoffs

### Architectural Decisions

| Decision | Rationale | Tradeoff |
|----------|----------|----------|
| **Lua in Redis** | Atomic execution prevents race conditions in distributed setup | More complex debugging; requires Redis with Lua support |
| **Wall-clock TIME()** | Works across servers with different local clocks | Depends on Redis server clock accuracy |
| **Discrete refills** | Simpler algorithm, predictable behavior | Less smooth than continuous rate limiting |
| **TTL auto-cleanup** | No explicit key management needed | Adds small memory overhead for unused keys |
| **Fixed config** | Simpler implementation, easier to reason about | No per-client customization without extension |

### Why Token Bucket?

The Token Bucket algorithm was chosen over alternatives for specific reasons:

#### Comparison with Alternatives

| Algorithm | Burst Support | Implementation Complexity | Memory Overhead |
|-----------|--------------|---------------------------|-----------------|
| **Token Bucket** | Yes (up to capacity) | Medium | Low |
| Leaky Bucket | Limited (fixed rate) | Medium | Low |
| Sliding Window | No (discrete windows) | High | Medium |
| Fixed Window | No (hard boundaries) | Low | Low |

**Token Bucket** provides the best balance for API rate limiting:
- Supports legitimate burst usage (e.g., batch API calls)
- Smooths traffic over time rather than hard cuts
- Simple Redis + Lua implementation

### Scalability Considerations

The current design trades off some flexibility for correctness:

1. **Single Redis Instance**: Uses single Redis rather than Redis Cluster for simplicity. Commands like `HMGET`/`HMSET` work but aren't optimal for sharded setups. Extension to Cluster would require key-based routing.

2. **API Key as Opaque String**: No built-in validation or enrichment. In production, consider adding an API key registry with metadata.

3. **Fixed Rate Limits**: All clients share the same rate limit configuration. Per-client limits would require extension but complicate the Lua script.

## Configuration

### Rate Limiter Configuration

```typescript
const rateLimiter = new RateLimiter(redisClient, {
  capacity: 10,      // Maximum tokens in bucket
  refillRate: 2,     // Tokens added per interval
  interval: 5,      // Refill interval in seconds
  keyPrefix: "rl",  // Redis key prefix
});
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `capacity` | `number` | Required | Maximum tokens in bucket |
| `refillRate` | `number` | Required | Tokens added per interval |
| `interval` | `number` | Required | Interval in seconds |
| `keyPrefix` | `string` | `"rl"` | Redis key prefix |

#### Configuration Examples

**Default (10 req/5s)**: 2 requests per second sustained, 10 burst
```typescript
{ capacity: 10, refillRate: 2, interval: 5 }
```

**Aggressive (100 req/1s)**: 100 requests per second sustained
```typescript
{ capacity: 100, refillRate: 100, interval: 1 }
```

**Conservative (5 req/10s)**: 0.5 requests per second sustained
```typescript
{ capacity: 5, refillRate: 1, interval: 10 }
```

### Redis Connection

```typescript
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
```

Configure via environment variable for container deployments.

### Server Port

```typescript
const PORT = Number(process.env.PORT ?? 3000);
```

## API Reference

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `x-api-key` | Yes | Client identifier for rate limiting |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum capacity for this client |
| `X-RateLimit-Remaining` | Current tokens remaining |
| `Retry-After` | Seconds until next token (only on 429) |

### Response Codes

| Code | Description |
|------|-------------|
| `200` | Request allowed |
| `401` | Missing `x-api-key` header |
| `429` | Rate limit exceeded |

### Example Requests

**Allowed Request**:
```bash
curl -H "x-api-key: my-client-id" http://localhost:3000/api/test
# Response: 200 OK
# Headers: X-RateLimit-Limit: 10, X-RateLimit-Remaining: 9
```

**Rate Limited Request**:
```bash
# After exhausting tokens
curl -H "x-api-key: my-client-id" http://localhost:3000/api/test
# Response: 429 Too Many Requests
# Headers: X-RateLimit-Limit: 10, X-RateLimit-Remaining: 0, Retry-After: 3
```

## Deployment

### Docker Compose

The `compose.yml` configures a complete distributed test environment:

```yaml
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  server1:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=3001
    depends_on:
      - redis

  server2:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=3002
    depends_on:
      - redis

  server3:
    build: .
    environment:
      - REDIS_URL=redis://redis:6379
      - PORT=3003
    depends_on:
      - redis

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "8080:80"
    depends_on:
      - server1
      - server2
      - server3
```

Start all services:
```bash
docker compose up --build
```

Access via nginx:
```bash
curl -H "x-api-key: test-key" http://localhost:8080/api/test
```

### Kubernetes (Conceptual)

For production Kubernetes deployments:

1. Deploy Redis as a StatefulSet or use managed Redis (e.g., AWS ElastiCache, Redis Cloud)
2. Deploy rate limiter servers as a Deployment with HPA for autoscaling
3. Use nginx Ingress for load distribution with rate limiting annotations

## Testing

### Integration Tests

The test suite verifies core functionality and edge cases:

```bash
npm test
```

**Core Functionality Tests** (`integration.test.ts`):
- Single request allowed
- Multiple requests within limit
- Burst handling (exhaust then refill)
- Concurrent requests (atomicity)
- TTL expiration for new keys
- Fresh key initialization
- Retry-after calculation

**Edge Case Tests** (`rateLimiter.test.ts`):
- Exact interval boundary refill
- Multiple intervals elapsed
- Partial intervals don't refill
- Independent key buckets

### Load Testing

Verify distributed behavior with concurrent requests:

```typescript
// 50 concurrent requests should allow exactly 10
const results = await Promise.all(
  Array(50).fill(null).map(() => rateLimiter.attemptRequest("concurrent-key"))
);
const allowed = results.filter(r => r.allowed).length;
console.assert(allowed === 10, "Expected exactly 10 allowed requests");
```

## Extension Points

### Custom Per-Client Limits

To support different rate limits per client:

1. Add API key metadata store in Redis or database
2. Modify middleware to look up client configuration
3. Pass client-specific config to `attemptRequest()`

### Alternative Algorithms

To implement leaky bucket:

1. Write new Lua script with leaky bucket logic
2. Create `LeakyBucket` class similar to `TokenBucket`
3. Update configuration to select algorithm

### Metrics and Observability

Add metrics via:

1. Prometheus metrics in middleware for request counts, rejections
2. Redis latency histogram for Lua script execution
3. Custom spans in distributed tracing

## Conclusion

This distributed rate limiter provides a solid foundation for API rate limiting in microservices architectures. The Token Bucket algorithm with atomic Lua execution in Redis ensures correctness across horizontally scaled server instances, while maintaining simplicity and performance.

Key strengths:
- **Correctness**: Atomic Lua execution eliminates race conditions
- **Simplicity**: Single Redis backend, no complex coordination
- **Scalability**: Add more server instances without architecture changes
- **Observability**: Standard rate limit headers for clients

The fixed configuration approach prioritizes simplicity and correctness over flexibility, making it well-suited for APIs where all clients share the same rate limit policy.