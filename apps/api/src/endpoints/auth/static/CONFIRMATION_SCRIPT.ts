const CONFIRMATION_SCRIPT = `
  local value = redis.call('GET', KEYS[1])
  if not value then
    return 0
  end
  local pending = cjson.decode(value)
  if pending.codeHash ~= ARGV[1] or pending.userId ~= ARGV[2] or pending.attemptsRemaining <= 0 then
    return 0
  end
  if ARGV[3] == '1' then
    redis.call('DEL', KEYS[1])
    return 1
  end
  pending.attemptsRemaining = pending.attemptsRemaining - 1
  if pending.attemptsRemaining <= 0 then
    redis.call('DEL', KEYS[1])
  else
    redis.call('SET', KEYS[1], cjson.encode(pending), 'KEEPTTL')
  end
  return 0
`

export { CONFIRMATION_SCRIPT }
