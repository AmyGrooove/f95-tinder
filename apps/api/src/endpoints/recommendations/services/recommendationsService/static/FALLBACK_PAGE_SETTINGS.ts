const FALLBACK_PAGE_SETTINGS = {
  namespace: "recommendations:fallback:v1",
  ttlMs: 10 * 60 * 1000,
  defaultPageSize: 20,
} as const

export { FALLBACK_PAGE_SETTINGS }
