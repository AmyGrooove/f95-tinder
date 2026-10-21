import { randomUUID } from "node:crypto"
import { APP_FILTER } from "@nestjs/core"
import { getConnectionToken } from "@nestjs/mongoose"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { Test } from "@nestjs/testing"
import { RedisToken } from "@nestjs-redis/client"
import { MongoDBContainer } from "@testcontainers/mongodb"
import { RedisContainer } from "@testcontainers/redis"
import { createConnection } from "mongoose"
import { createClient } from "redis"

import { AccountModule } from "@endpoints/account/account.module"
import { AuthModule } from "@endpoints/auth/auth.module"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { createDatabaseOptions } from "@infrastructure/database/functions/createDatabaseOptions"
import { AppExceptionFilter } from "@infrastructure/logger/decorators/AppExceptionFilter"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { MailModule } from "@infrastructure/mail/mail.module"
import { ThrottlingModule } from "@infrastructure/throttling/throttling.module"

import { createTestConfiguration } from "@test/functions/createTestConfiguration"
import { TestMailModule, TestMailService } from "@test/modules/testMail"

import { configureApplication } from "../../../../app/functions/configureApplication"

const createTestApplication = async () => {
  const cleanup: Array<() => Promise<unknown>> = []
  const redisErrors: unknown[] = []
  const close = async () => {
    const errors: unknown[] = []

    while (cleanup.length > 0) {
      const dispose = cleanup.pop()

      try {
        await dispose?.()
      } catch (error) {
        errors.push(error)
      }
    }

    errors.push(...redisErrors)

    if (errors.length > 0) {
      throw new AggregateError(errors, "Не удалось закрыть тестовое окружение")
    }
  }

  try {
    const mongoContainer = await new MongoDBContainer("mongo:8.0.17").start()
    cleanup.push(async () => mongoContainer.stop())

    const redisContainer = await new RedisContainer(
      "redis:8.2.3-alpine",
    ).start()
    cleanup.push(async () => redisContainer.stop())

    const mongoUrl = new URL(mongoContainer.getConnectionString())
    mongoUrl.pathname = `/bisky_test_${randomUUID()}`
    mongoUrl.searchParams.set("directConnection", "true")

    const configuration = createTestConfiguration(
      mongoUrl.toString(),
      redisContainer.getConnectionUrl(),
    )
    const { uri, connectionFactory, ...databaseOptions } =
      createDatabaseOptions(new InfrastructureConfigService(configuration))
    const connection = createConnection(uri, databaseOptions)
    cleanup.push(async () => connection.close(true))
    await connection.asPromise()
    connectionFactory(connection)

    const connectRedis = async () => {
      const client = createClient({
        url: configuration.redis.url,
        socket: { reconnectStrategy: false },
      })
      client.on("error", (error: Error) => {
        redisErrors.push(error)
      })
      cleanup.push(async () => {
        if (client.isOpen) {
          await client.close()
        }
      })
      await client.connect()

      return client
    }

    const redis = await connectRedis()
    const authRedis = await connectRedis()
    const accountRedis = await connectRedis()

    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule, AccountModule, LoggerModule, ThrottlingModule],
      providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
    })
      .overrideModule(MailModule)
      .useModule(TestMailModule)
      .overrideProvider(infrastructureConfiguration.KEY)
      .useValue(configuration)
      .overrideProvider(getConnectionToken())
      .useValue(connection)
      .overrideProvider(RedisToken())
      .useValue(redis)
      .overrideProvider(RedisToken("auth"))
      .useValue(authRedis)
      .overrideProvider(RedisToken("account"))
      .useValue(accountRedis)
      .compile()

    const lifecycle = { close: async () => moduleRef.close() }
    cleanup.push(async () => lifecycle.close())

    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        trustProxy: ["loopback", "linklocal", "uniquelocal"],
      }),
      { logger: false },
    )
    lifecycle.close = async () => app.close()

    await configureApplication(app)
    await app.init()
    await app.getHttpAdapter().getInstance().ready()

    const mail = app.get(TestMailService)

    await Promise.all(
      Object.values(connection.models).map(async (model) => model.init()),
    )

    const reset = async () => {
      if (redisErrors.length > 0) {
        throw new AggregateError(redisErrors, "Ошибка тестового Redis")
      }

      await Promise.all(
        Object.values(connection.collections).map(async (collection) => {
          await collection.deleteMany({})
        }),
      )
      await redis.flushDb()
      mail.clear()
    }

    return { app, connection, redis, mail, reset, close }
  } catch (error) {
    try {
      await close()
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Ошибка запуска и очистки тестового окружения",
        { cause: cleanupError },
      )
    }

    throw error
  }
}

export { createTestApplication }
