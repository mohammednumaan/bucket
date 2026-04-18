local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local interval = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

if not capacity or capacity <= 0 then
    return { -1, 0, 0 }
end
if not refillRate or refillRate <= 0 then
    return { -1, 0, 0 }
end
if not interval or interval <= 0 then
    return { -1, 0, 0 }
end
if not requested or requested < 0 or requested ~= math.floor(requested) then
    return { -1, 0, 0 }
end

local intervalMs = interval * 1000
local time = redis.call('TIME')
local nowMs = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)

local bucket = redis.call('HMGET', key, 'tokens', 'lastRefillTimestamp')
local tokens = tonumber(bucket[1])
local lastRefillTimestamp = tonumber(bucket[2])

if not tokens then
    tokens = capacity
    lastRefillTimestamp = nowMs

else 
    local secondsElapsed = (nowMs - lastRefillTimestamp) / 1000;
    if (secondsElapsed >= interval) then
        local intervalsCompleted = math.floor(secondsElapsed / interval)
        local tokensToAdd = intervalsCompleted * refillRate
        tokens = math.min(tokens + tokensToAdd, capacity)
        lastRefillTimestamp = lastRefillTimestamp + (intervalsCompleted * intervalMs)

    end
end

local allowed = 0
if tokens >= requested then
    allowed = 1
    tokens = tokens - requested
end

redis.call('HMSET', key, 'tokens', tokens, 'lastRefillTimestamp', lastRefillTimestamp, 'lastUsedTimestamp', nowMs)

local ttl = math.ceil((capacity / refillRate) * interval) + 1
redis.call('EXPIRE', key, ttl)

if allowed == 0 then
    local needed = requested - tokens
    local intervalsNeeded = math.ceil(needed / refillRate)
    local resetMs = lastRefillTimestamp + (intervalsNeeded * intervalMs)
    local retryAfter = math.ceil((resetMs - nowMs) / 1000)
    if retryAfter < 0 then retryAfter = 0 end
    return { allowed, tokens, retryAfter }
end

return { allowed, tokens, 0} 
