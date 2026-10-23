import { afterAll, beforeAll, beforeEach } from "@jest/globals"

import { isNil } from "@shared/functions/checks/isNil"
import { createTestApplication } from "@test/functions/createTestApplication"

let application: Awaited<ReturnType<typeof createTestApplication>> | undefined

const getTestApplication = () => {
  if (isNil(application)) {
    throw new Error("Тестовое приложение ещё не запущено")
  }

  return application
}

beforeAll(async () => {
  application = await createTestApplication()
}, 300_000)

beforeEach(async () => {
  await getTestApplication().reset()
})

afterAll(async () => {
  try {
    await application?.close()
  } finally {
    application = undefined
  }
}, 60_000)

export { getTestApplication }
