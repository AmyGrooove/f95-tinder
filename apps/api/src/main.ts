import { NestFactory } from "@nestjs/core"
import { FastifyAdapter } from "@nestjs/platform-fastify"
import type { NestFastifyApplication } from "@nestjs/platform-fastify"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { AppModule } from "./app/app.module"
import { configureApplication } from "./app/functions/configureApplication"
import { configureSwagger } from "./app/functions/configureSwagger"
import { configureKnowledge } from "./app/functions/configureKnowledge"

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
  configureSwagger(app)
  configureKnowledge(app)

  app.enableShutdownHooks()

  await app.listen(appConfiguration.port, "0.0.0.0")
}

try {
  await bootstrap()
} catch (error: unknown) {
  console.error(error)
  process.exitCode = 1
}
