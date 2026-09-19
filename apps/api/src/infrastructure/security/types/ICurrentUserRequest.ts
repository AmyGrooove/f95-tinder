import type { IAuthPrincipal } from "./IAuthPrincipal"

interface ICurrentUserRequest {
  authPrincipal?: IAuthPrincipal
}

export type { ICurrentUserRequest }
