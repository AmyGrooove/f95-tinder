import { afterAll, beforeAll, beforeEach } from "@jest/globals"

import { createTestConfiguration } from "@test/functions/createTestConfiguration"
import { createTestRedis } from "@test/functions/createTestRedis"

let environment:
  | (Awaited<ReturnType<typeof createTestRedis>> & {
      configuration: ReturnType<typeof createTestConfiguration>
    })
  | undefined

const getTestRedis = () => {
  if (environment === undefined) {
    throw new Error("Тестовый Redis ещё не подключён")
  }

  return environment
}

beforeAll(async () => {
  const mongoUri = process.env.BISKY_TEST_MONGO_URL

  if (mongoUri === undefined) {
    throw new Error("Тестовые контейнеры ещё не запущены")
  }

  const redis = await createTestRedis()
  environment = {
    ...redis,
    configuration: createTestConfiguration(mongoUri, redis.url),
  }
})

beforeEach(async () => {
  await getTestRedis().reset()
})

afterAll(async () => {
  try {
    await environment?.close()
  } finally {
    environment = undefined
  }
})

export { getTestRedis }
