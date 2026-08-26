import { ValidationPipe, VersioningType } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { AppModule } from "./app/app.module"

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  )

  const configurationService = app.get(InfrastructureConfigService)
  const appConfiguration = configurationService.app
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
    .setTitle("F95 Tinder API")
    .setDescription("Remote backend API for F95 Tinder")
    .setVersion(appConfiguration.version ?? "unknown")
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

  app.enableShutdownHooks()

  await app.listen(appConfiguration.port, "0.0.0.0")
}

void bootstrap()
