import type { NestFastifyApplication } from "@nestjs/platform-fastify"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

const configureSwagger = (app: NestFastifyApplication) => {
  const appConfiguration = app.get(InfrastructureConfigService).app
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
}

export { configureSwagger }
