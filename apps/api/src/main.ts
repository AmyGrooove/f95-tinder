import helmet from "@fastify/helmet"
import multipart from "@fastify/multipart"
import { ValidationPipe, VersioningType } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { requestContext } from "@shared/functions/requestContext"

import { AppModule } from "./app/app.module"

const bootstrap = async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: ["loopback", "linklocal", "uniquelocal"],
    }),
  )

  const configurationService = app.get(InfrastructureConfigService)
  const appConfiguration = configurationService.app

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

  const swaggerConfig = new DocumentBuilder()
    .setTitle(appConfiguration.name)
    .setDescription(appConfiguration.description)
    .setVersion(appConfiguration.version)
    .addCookieAuth("__Host-accessToken", { type: "apiKey" }, "accessCookie")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      "authToken",
    )
    .build()
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig)

  SwaggerModule.setup("docs", app, swaggerDocument)

  fastify.addHook("onSend", (request, reply, payload, done) => {
    const isSwaggerRoute =
      request.url === "/docs" ||
      request.url.startsWith("/docs/") ||
      request.url.startsWith("/docs?")

    if (isSwaggerRoute) {
      reply.removeHeader("content-security-policy")
    }

    done(null, payload)
  })

  app.enableShutdownHooks()

  await app.listen(appConfiguration.port, "0.0.0.0")
}

await bootstrap().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
