import type { TJwtClaims } from "./TJwtClaims"
import type { TJwtTokenType } from "./TJwtTokenType"

type TJwtPayload<TExtension extends object = Record<never, never>> =
  TJwtClaims &
    TExtension & {
      type: TJwtTokenType
    }

export type { TJwtPayload }
