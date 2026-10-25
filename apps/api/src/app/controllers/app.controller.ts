import { randomUUID } from "node:crypto"

import { HealthService } from "@infrastructure/health/services/health.service"
import {
  BadGatewayException,
  Controller,
  Get,
  Header,
  Headers,
  HttpException,
  Res,
} from "@nestjs/common"
import { ApiExcludeEndpoint } from "@nestjs/swagger"

import { getRandomBackground } from "../functions/getRandomBackground"
import { BACKGROUNDS } from "../static/BACKGROUNDS"
import { HOME_PAGE_HTML } from "../static/HOME_PAGE_HTML"
import { SERVICE_HEALTH_ICONS } from "../static/SERVICE_HEALTH_ICONS"
import { SERVICE_HEALTH_HTML } from "../static/SERVICE_HEALTH_HTML"

@Controller("")
class AppController {
  constructor(private readonly healthService: HealthService) {}

  @ApiExcludeEndpoint(true)
  @Get("background")
  @Header("Cache-Control", "no-store")
  async getBackground(
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true })
    response: {
      header: (name: string, value: string) => void
    },
  ) {
    const previousIndex = cookie?.match(
      /(?:^|;\s*)biskyBackground=(\d+)(?:;|$)/,
    )?.[1]
    const previousBackground =
      previousIndex === undefined
        ? undefined
        : BACKGROUNDS[Number(previousIndex)]
    const background = getRandomBackground(previousBackground)
    const backgroundResponse = await fetch(background)
    const contentType = backgroundResponse.headers.get("content-type") ?? ""

    if (!backgroundResponse.ok || !contentType.startsWith("image/")) {
      throw new BadGatewayException()
    }

    response.header(
      "Set-Cookie",
      `biskyBackground=${BACKGROUNDS.indexOf(background)}; Path=/background; HttpOnly; SameSite=Lax`,
    )
    response.header("Content-Type", contentType)

    return Buffer.from(await backgroundResponse.arrayBuffer())
  }

  @ApiExcludeEndpoint(true)
  @Get("")
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  async getHomePage() {
    const healthResponse = (await this.healthService
      .checkHealth()
      .catch((error: unknown) => {
        if (!(error instanceof HttpException)) {
          throw error
        }

        return error.getResponse()
      })) as { details?: Record<string, { status: string }> }

    const healthStatuses = Object.entries(healthResponse.details ?? {})
      .map(([serviceName, serviceHealth]) => {
        const isHealthy = serviceHealth.status === "up"

        return SERVICE_HEALTH_HTML.replace(
          "{{statusClass}}",
          isHealthy ? "is-up" : "is-down",
        )
          .replace("{{serviceName}}", serviceName)
          .replace("{{icon}}", SERVICE_HEALTH_ICONS[serviceName])
          .replace("{{status}}", isHealthy ? "Работает" : "Недоступен")
      })
      .join("")

    return HOME_PAGE_HTML.replace("{{healthStatuses}}", healthStatuses).replace(
      "{{backgroundRequest}}",
      randomUUID(),
    )
  }
}

export { AppController }
