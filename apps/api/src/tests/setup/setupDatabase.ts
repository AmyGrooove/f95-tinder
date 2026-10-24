import { afterAll, beforeAll, beforeEach } from "@jest/globals"

import { createTestDatabase } from "@test/functions/createTestDatabase"

let database: Awaited<ReturnType<typeof createTestDatabase>> | undefined

const getTestDatabase = () => {
  if (database === undefined) {
    throw new Error("Тестовая MongoDB ещё не подключена")
  }

  return database
}

beforeAll(async () => {
  database = await createTestDatabase()
})

beforeEach(async () => {
  await getTestDatabase().reset()
})

afterAll(async () => {
  try {
    await database?.close()
  } finally {
    database = undefined
  }
})

export { getTestDatabase }
