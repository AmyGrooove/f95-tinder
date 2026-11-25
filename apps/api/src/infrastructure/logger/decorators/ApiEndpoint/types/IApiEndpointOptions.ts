import type { ApiResponseOptions, TagObject } from "@nestjs/swagger"

type ApiEndpointTag = Pick<TagObject, "name" | "parent">

interface IApiEndpointOptions {
  operationId: string
  summary: string

  description: string
  tags?: (string | ApiEndpointTag)[]
  response: ApiResponseOptions & { status: number }
  errors?: ApiResponseOptions[]
  auth?: string
}

export type { ApiEndpointTag, IApiEndpointOptions }
