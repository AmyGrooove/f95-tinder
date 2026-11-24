const LIBRARY_ACTIVITY_SCRIPTS = {
  stage: `
    local clock = redis.call('TIME')
    local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
    local pair, nextId, before, after, revision, delay = unpack(ARGV)
    local id = redis.call('HGET', KEYS[1], pair)
    local stored = id and redis.call('HGET', KEYS[2], id)
    local dueAt = now + tonumber(delay)
    local batch
    if stored and tonumber(redis.call('ZSCORE', KEYS[3], id) or 0) > now then
      batch = cjson.decode(stored)
      if revision ~= '' and batch.firstRevision ~= '' and revision < batch.firstRevision then
        batch.before = cjson.decode(before)
        batch.firstRevision = revision
      end
      if revision == '' or batch.lastRevision == '' or revision >= batch.lastRevision then
        batch.after = cjson.decode(after)
        batch.lastRevision = revision
        batch.observedAt = now
      end
    else
      id = nextId
      batch = {
        id = id, pair = pair, before = cjson.decode(before), after = cjson.decode(after),
        firstRevision = revision, lastRevision = revision, observedAt = now
      }
      redis.call('HSET', KEYS[1], pair, id)
    end
    redis.call('HSET', KEYS[2], id, cjson.encode(batch))
    redis.call('ZADD', KEYS[3], dueAt, id)
  `,
  claim: `
    local clock = redis.call('TIME')
    local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
    local due = redis.call('ZRANGEBYSCORE', KEYS[3], '-inf', now, 'LIMIT', 0, ARGV[1])
    local batches = {}
    for _, id in ipairs(due) do
      local stored = redis.call('HGET', KEYS[2], id)
      if stored then
        local pair = cjson.decode(stored).pair
        if redis.call('HGET', KEYS[1], pair) == id then
          redis.call('HDEL', KEYS[1], pair)
        end
        redis.call('ZADD', KEYS[3], now + tonumber(ARGV[2]), id)
        table.insert(batches, stored)
      else
        redis.call('ZREM', KEYS[3], id)
      end
    end
    return batches
  `,
  acknowledge: `
    redis.call('HDEL', KEYS[2], ARGV[1])
    redis.call('ZREM', KEYS[3], ARGV[1])
  `,
}

export { LIBRARY_ACTIVITY_SCRIPTS }
