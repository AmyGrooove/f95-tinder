const teardownIntegration = async () => {
  const containers = globalThis.__BISKY_TEST_CONTAINERS__ ?? []
  const results = await Promise.allSettled(
    containers.map(async (container) => container.stop()),
  )
  delete globalThis.__BISKY_TEST_CONTAINERS__
  delete process.env.BISKY_TEST_MONGO_URL
  delete process.env.BISKY_TEST_REDIS_URL
  const errors = results.flatMap((result) => {
    return result.status === "rejected" ? [result.reason] : []
  })

  if (errors.length > 0) {
    throw new AggregateError(
      errors,
      "Не удалось остановить тестовые контейнеры",
    )
  }
}

export default teardownIntegration
