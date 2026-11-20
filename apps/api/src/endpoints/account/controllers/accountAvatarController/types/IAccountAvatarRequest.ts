import type { FastifyRequest } from "fastify"

interface IAccountAvatarRequest extends FastifyRequest {
  avatarOwnerId: string
}

export type { IAccountAvatarRequest }
