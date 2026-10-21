import { NestFactory } from "@nestjs/core"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { AppModule } from "./app/app.module"
import { configureApplication } from "./app/functions/configureApplication"

const bootstrap = async () => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: ["loopback", "linklocal", "uniquelocal"],
    }),
  )

  const configurationService = app.get(InfrastructureConfigService)
  const appConfiguration = configurationService.app

  await configureApplication(app)

  const fastify = app.getHttpAdapter().getInstance()

  const swaggerConfig = new DocumentBuilder()
    .setTitle(appConfiguration.name)
    .setDescription(appConfiguration.description)
    .setVersion(appConfiguration.version)
    .addCookieAuth("__Host-accessToken", { type: "apiKey" }, "accessCookie")
    .addCookieAuth("__Host-refreshToken", { type: "apiKey" }, "refreshCookie")
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
