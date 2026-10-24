import { randomUUID } from "node:crypto"
import { createConnection } from "mongoose"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { createDatabaseOptions } from "@infrastructure/database/functions/createDatabaseOptions"
import { createTestConfiguration } from "@test/functions/createTestConfiguration"

const createTestDatabase = async () => {
  const mongoUri = process.env.BISKY_TEST_MONGO_URL
  const redisUrl = process.env.BISKY_TEST_REDIS_URL

  if (mongoUri === undefined || redisUrl === undefined) {
    throw new Error("Тестовые контейнеры ещё не запущены")
  }

  const url = new URL(mongoUri)
  url.pathname = `/bisky_test_${randomUUID()}`
  url.searchParams.set("directConnection", "true")
  const configuration = createTestConfiguration(url.toString(), redisUrl)
  const { uri, connectionFactory, ...options } = createDatabaseOptions(
    new InfrastructureConfigService(configuration),
  )
  const connection = createConnection(uri, options)
  const close = async () => {
    try {
      if (connection.readyState === 1) {
        await connection.dropDatabase()
      }
    } finally {
      await connection.close(true)
    }
  }

  try {
    await connection.asPromise()
    connectionFactory(connection)
  } catch (error) {
    await close()
    throw error
  }

  const reset = async () => {
    await Promise.all(
      Object.values(connection.collections).map(async (collection) => {
        await collection.deleteMany({})
      }),
    )
  }

  return { connection, uri, reset, close }
}

export { createTestDatabase }
