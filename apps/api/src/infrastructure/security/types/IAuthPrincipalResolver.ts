import type { IAuthPrincipal } from "./IAuthPrincipal"
import type { TJwtPayload } from "./TJwtPayload"

interface IAuthPrincipalResolver {
  resolve(payload: TJwtPayload): Promise<IAuthPrincipal>
}

export type { IAuthPrincipalResolver }
