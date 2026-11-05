import {
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import { STORAGE_CLIENT } from "@infrastructure/storage/static/STORAGE_CLIENT"
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
import { TagCollectionsInitializationService } from "@endpoints/collection/services/tagCollectionsInitializationService"
import { AuthModule } from "@endpoints/auth/auth.module"
import { UserItemEndpointModule } from "@endpoints/userItem/userItem.module"
import { SearchEndpointModule } from "@endpoints/search/search.module"
import { infrastructureConfiguration } from "@infrastructure/config/config.module"
import { AppExceptionFilter } from "@infrastructure/logger/decorators/AppExceptionFilter"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { JobProcessorService } from "@infrastructure/jobs/services/jobProcessorService"
import { MailModule } from "@infrastructure/mail/mail.module"
import { ThrottlingModule } from "@infrastructure/throttling/throttling.module"

import { createTestConfiguration } from "@infrastructure/config/__tests__/setup/createTestConfiguration"
import { createTestDatabase } from "@infrastructure/database/__tests__/setup/createTestDatabase"
import { createTestRedis } from "@infrastructure/cache/__tests__/setup/createTestRedis"
import { TestMailModule } from "@infrastructure/mail/__tests__/setup/TestMailModule/testMail.module"
import { TestMailService } from "@infrastructure/mail/__tests__/setup/TestMailModule/testMail.service"

import { configureApplication } from "../../functions/configureApplication"

const createTestApplication = async (search?: {
  host: string
  apiKey: string
}) => {
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
    if (search !== undefined) {
      configuration.search = search
    }
    const { redis } = redisEnvironment
    const authRedis = await redisEnvironment.connect()
    const accountRedis = await redisEnvironment.connect()

    const objects = new Map<string, number>()
    const storageClient = {
      send: async (command: unknown) => {
        if (command instanceof HeadBucketCommand) {
          return {}
        }
        if (
          command instanceof PutObjectCommand &&
          command.input.Key &&
          Buffer.isBuffer(command.input.Body)
        ) {
          objects.set(command.input.Key, command.input.Body.length)
          return {}
        }
        if (command instanceof HeadObjectCommand && command.input.Key) {
          const size = objects.get(command.input.Key)
          if (size === undefined) {
            throw new S3ServiceException({
              name: "NotFound",
              $fault: "client",
              $metadata: { httpStatusCode: 404 },
            })
          }
          return { ContentLength: size }
        }
        if (command instanceof DeleteObjectCommand && command.input.Key) {
          objects.delete(command.input.Key)
          return {}
        }
        throw new Error("Неожиданная команда тестового S3")
      },
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthModule,
        AccountModule,
        UserItemEndpointModule,
        CollectionEndpointModule,
        ...(search === undefined ? [] : [SearchEndpointModule]),
        LoggerModule,
        ThrottlingModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
    })
      .overrideModule(MailModule)
      .useModule(TestMailModule)
      .overrideProvider(STORAGE_CLIENT)
      .useValue(storageClient)
      .overrideProvider(TagCollectionsInitializationService)
      .useValue({})
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
