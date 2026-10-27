import { APP_FILTER } from "@nestjs/core"
import { getConnectionToken } from "@nestjs/mongoose"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { Test } from "@nestjs/testing"
import { RedisToken } from "@nestjs-redis/client"

import { AccountModule } from "@endpoints/account/account.module"
import { CollectionEndpointModule } from "@endpoints/collection/collection.module"
import { AuthModule } from "@endpoints/auth/auth.module"
import { UserItemEndpointModule } from "@endpoints/userItem/userItem.module"
import { ItemEndpointModule } from "@endpoints/item/item.module"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { AppExceptionFilter } from "@infrastructure/logger/decorators/AppExceptionFilter"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { JobProcessorService } from "@infrastructure/jobs/services/jobProcessor.service"
import { MailModule } from "@infrastructure/mail/mail.module"
import { ThrottlingModule } from "@infrastructure/throttling/throttling.module"

import { createTestConfiguration } from "@test/functions/createTestConfiguration"
import { createTestDatabase } from "@test/functions/createTestDatabase"
import { createTestRedis } from "@test/functions/createTestRedis"
import { TestMailModule, TestMailService } from "@test/modules/testMail"

import { configureApplication } from "../../../../app/functions/configureApplication"

const createTestApplication = async () => {
  const cleanup: Array<() => Promise<unknown>> = []
  const close = async () => {
    const errors: unknown[] = []

    while (cleanup.length > 0) {
      const dispose = cleanup.pop()

      try {
        await dispose?.()
      } catch (error) {
        if (error instanceof AggregateError) {
          errors.push(...error.errors)
        } else {
          errors.push(error)
        }
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, "Не удалось закрыть тестовое окружение")
    }
  }

  try {
    const database = await createTestDatabase()
    cleanup.push(database.close)
    const redisEnvironment = await createTestRedis()
    cleanup.push(redisEnvironment.close)
    const { connection } = database
    const configuration = createTestConfiguration(
      database.uri,
      redisEnvironment.url,
    )
    const { redis } = redisEnvironment
    const authRedis = await redisEnvironment.connect()
    const accountRedis = await redisEnvironment.connect()

    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthModule,
        AccountModule,
        UserItemEndpointModule,
        CollectionEndpointModule,
        ItemEndpointModule,
        LoggerModule,
        ThrottlingModule,
      ],
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
    cleanup.push(async () => {
      try {
        await connection.dropDatabase()
      } finally {
        await lifecycle.close()
      }
    })

    const app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter({
        trustProxy: ["loopback", "linklocal", "uniquelocal"],
      }),
      { logger: false },
    )
    lifecycle.close = async () => app.close()

    await configureApplication(app)
    await app.init()
    await app.get(JobProcessorService).worker.pause()
    await app.getHttpAdapter().getInstance().ready()

    const mail = app.get(TestMailService)

    await Promise.all(
      Object.values(connection.models).map(async (model) => model.init()),
    )

    const reset = async () => {
      await redisEnvironment.reset()
      await database.reset()
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
