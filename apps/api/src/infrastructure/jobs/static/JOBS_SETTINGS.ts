const JOBS_SETTINGS = {
  concurrency: 10,
  removeOnComplete: { age: 60 * 60 * 24 * 7, count: 1_000 },
  removeOnFail: { age: 60 * 60 * 24 * 14, count: 2_000 },
} as const

export { JOBS_SETTINGS }
