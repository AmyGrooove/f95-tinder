import type { IAuthPrincipal } from "@infrastructure/security/types/IAuthPrincipal"

interface ICurrentUserRequest {
  authPrincipal?: IAuthPrincipal
}

export type { ICurrentUserRequest }
