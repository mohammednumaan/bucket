local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local interval = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

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

return { allowed, tokens } 
