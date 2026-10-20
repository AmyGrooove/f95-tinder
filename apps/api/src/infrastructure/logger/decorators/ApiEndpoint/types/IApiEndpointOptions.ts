import type { ApiResponseOptions } from "@nestjs/swagger"

interface IApiEndpointOptions {
  operationId: string
  summary: string

  description?: string
  response?: ApiResponseOptions & { status: number }
  errors?: ApiResponseOptions[]
  auth?: string
}

export type { IApiEndpointOptions }
