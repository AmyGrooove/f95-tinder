import { createClient } from "redis"

const createTestRedis = async () => {
  const redisUrl = process.env.BISKY_TEST_REDIS_URL

  if (redisUrl === undefined) {
    throw new Error("Тестовый Redis ещё не запущен")
  }

  const clients: Array<
    Pick<
      ReturnType<typeof createClient>,
      "isOpen" | "close" | "flushDb" | "select" | "sAdd"
    >
  > = []
  const redisErrors: unknown[] = []
  const url = new URL(redisUrl)
  const connect = async () => {
    const client = createClient({
      url: url.toString(),
      socket: { reconnectStrategy: false },
    })
    client.on("error", (error: Error) => {
      redisErrors.push(error)
    })
    clients.push(client)
    await client.connect()

    return client
  }
  let database: string | undefined
  const close = async () => {
    const errors: unknown[] = []
    const [redis, ...otherClients] = clients

    for (const client of otherClients.reverse()) {
      try {
        if (client.isOpen) {
          await client.close()
        }
      } catch (error) {
        errors.push(error)
      }
    }

    if (redis?.isOpen === true) {
      try {
        if (database !== undefined) {
          await redis.flushDb()
          await redis.select(0)
          await redis.sAdd("bisky:test:available-databases", database)
          database = undefined
        }
      } catch (error) {
        errors.push(error)
      } finally {
        try {
          await redis.close()
        } catch (error) {
          errors.push(error)
        }
      }
    }

    errors.push(...redisErrors)

    if (errors.length > 0) {
      throw new AggregateError(errors, "Не удалось закрыть тестовый Redis")
    }
  }

  try {
    const lease = await connect()
    const available = await lease.sPop("bisky:test:available-databases")

    if (available === null) {
      throw new Error("Нет свободной базы тестового Redis")
    }

    await lease.select(Number(available))
    database = available
    url.pathname = `/${database}`
    const redis = await connect()

    const reset = async () => {
      if (redisErrors.length > 0) {
        throw new AggregateError(redisErrors, "Ошибка тестового Redis")
      }

      await redis.flushDb()
    }

    return { redis, url: url.toString(), connect, reset, close }
  } catch (error) {
    try {
      await close()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Ошибка запуска и очистки Redis",
        { cause: cleanupError },
      )
    }

    throw error
  }
}

export { createTestRedis }
