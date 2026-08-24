import { Injectable } from "@nestjs/common"
import { plainToInstance } from "class-transformer"
import { validateOrReject } from "class-validator"
import type { ValidationError } from "class-validator"

import { buildLatestUrl } from "../functions/buildLatestUrl"
import { F95_RATE_LIMIT_WAIT_MS } from "../static/F95_RATE_LIMIT_WAIT_MS"
import { F95LatestResponseDto } from "../types/TF95LatestResponse"
import type { TF95LatestClientResult } from "../types/TF95LatestClientResult"
import type { TF95LatestResponse } from "../types/TF95LatestResponse"

@Injectable()
class F95LatestClient {
  async fetchLatestPage(page: number): Promise<TF95LatestClientResult> {
    const response = await fetch(buildLatestUrl(page), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })

    if (response.status === 429) {
      return {
        status: "rateLimited",
        retryAfterMs: F95_RATE_LIMIT_WAIT_MS,
      }
    }

    if (!response.ok) {
      throw new Error(
        `F95 latest request failed with status ${response.status}`,
      )
    }

    const responseBody = (await response.json()) as unknown
    const responseDto = plainToInstance(F95LatestResponseDto, responseBody)

    try {
      await validateOrReject(responseDto, {
        whitelist: true,
        forbidNonWhitelisted: false,
      })
    } catch (error) {
      if (Array.isArray(error)) {
        throw new Error(this.createValidationErrorMessage(error), {
          cause: error,
        })
      }

      throw error
    }

    const latestResponse = responseDto as TF95LatestResponse

    if (latestResponse.status !== "ok") {
      throw new Error("F95 latest response status is not ok")
    }

    return {
      status: "ok",
      threadItems: latestResponse.msg.data.slice(0, 20),
      page: latestResponse.msg.pagination.page,
      totalPages: latestResponse.msg.pagination.total,
    }
  }

  private createValidationErrorMessage(validationErrors: ValidationError[]) {
    const validationErrorMessages =
      this.collectValidationErrorMessages(validationErrors)

    return `F95 latest response validation failed: ${validationErrorMessages.join("; ")}`
  }

  private collectValidationErrorMessages(
    validationErrors: ValidationError[],
    parentPath = "",
  ) {
    const messages: string[] = []

    validationErrors.forEach((validationError) => {
      const propertyPath = parentPath
        ? `${parentPath}.${validationError.property}`
        : validationError.property

      if (validationError.constraints) {
        Object.values(validationError.constraints).forEach(
          (constraintMessage) => {
            messages.push(`${propertyPath}: ${constraintMessage}`)
          },
        )
      }

      if (validationError.children && validationError.children.length > 0) {
        messages.push(
          ...this.collectValidationErrorMessages(
            validationError.children,
            propertyPath,
          ),
        )
      }
    })

    return messages
  }
}

export { F95LatestClient }
