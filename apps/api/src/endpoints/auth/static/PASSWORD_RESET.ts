const PASSWORD_RESET = {
  expirationSeconds: 4 * 60 * 60,
  resendSeconds: 60,
  attempts: 3,
  saveScript: `
    if redis.call('EXISTS', KEYS[2]) == 1 then
      return 0
    end
    redis.call('SET', KEYS[2], '1', 'EX', ARGV[3])
    if ARGV[1] ~= '' then
      redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
    end
    return 1
  `,
  discardScript: `
    local value = redis.call('GET', KEYS[1])
    if value and cjson.decode(value).codeHash == ARGV[1] then
      redis.call('DEL', KEYS[1])
    end
    return 1
  `,
} as const

export { PASSWORD_RESET }
