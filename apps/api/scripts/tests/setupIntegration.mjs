import { MongoDBContainer } from "@testcontainers/mongodb"
import { RedisContainer } from "@testcontainers/redis"
import { createClient } from "redis"

import teardownIntegration from "./teardownIntegration.mjs"

const setupIntegration = async ({ maxWorkers }) => {
  const databaseCount = maxWorkers * 2
  const results = await Promise.allSettled([
    new MongoDBContainer("mongo:8.0.17").start(),
    new RedisContainer("redis:8.2.3-alpine")
      .withCommand(["redis-server", "--databases", String(databaseCount + 1)])
      .start(),
  ])
  globalThis.__BISKY_TEST_CONTAINERS__ = results.flatMap((result) => {
    return result.status === "fulfilled" ? [result.value] : []
  })

  try {
    const [mongo, redis] = results

    if (mongo.status === "rejected") {
      throw mongo.reason
    }

    if (redis.status === "rejected") {
      throw redis.reason
    }

    const client = createClient({
      url: redis.value.getConnectionUrl(),
      socket: { reconnectStrategy: false },
    })
    const errors = []
    client.on("error", (error) => errors.push(error))

    try {
      await client.connect()
      await client.sAdd(
        "bisky:test:available-databases",
        Array.from({ length: databaseCount }, (_, index) => String(index + 1)),
      )
    } finally {
      if (client.isOpen) {
        await client.close()
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Не удалось подготовить тестовый Redis")
    }

    process.env.BISKY_TEST_MONGO_URL = mongo.value.getConnectionString()
    process.env.BISKY_TEST_REDIS_URL = redis.value.getConnectionUrl()
  } catch (error) {
    try {
      await teardownIntegration()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Ошибка запуска и очистки контейнеров",
        { cause: cleanupError },
      )
    }

    throw error
  }
}

export default setupIntegration
