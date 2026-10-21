import helmet from "@fastify/helmet"
import multipart from "@fastify/multipart"
import { ValidationPipe, VersioningType } from "@nestjs/common"
import type { NestFastifyApplication } from "@nestjs/platform-fastify"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { requestContext } from "@shared/functions/context/requestContext"

const configureApplication = async (app: NestFastifyApplication) => {
  const appConfiguration = app.get(InfrastructureConfigService).app

  app.enableCsrfProtection({
    trustedOrigins: appConfiguration.corsOrigins.filter(
      (origin) => origin !== "*",
    ),
  })

  const fastify = app.getHttpAdapter().getInstance()

  await app.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 64 * 1024,
      fields: 20,
      fileSize: 25 * 1024 * 1024,
      files: 1,
      parts: 21,
    },
  })
  await app.register(helmet)

  fastify.addHook("onRequest", (request, _reply, done) => {
    requestContext.run(
      {
        requestId: request.id,
        method: request.method,
        path: request.url.split("?")[0],
      },
      done,
    )
  })

  const corsOrigin =
    appConfiguration.environment !== "production"
      ? true
      : appConfiguration.corsOrigins

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  })

  app.enableVersioning({
    type: VersioningType.URI,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
}

export { configureApplication }
