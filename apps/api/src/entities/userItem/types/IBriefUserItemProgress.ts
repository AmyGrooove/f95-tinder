import type { EUnit } from "@entities/shared/schemas/EUnit"

interface IBriefUserItemProgress {
  value: number
  unit: EUnit.MINUTE | EUnit.EPISODE | EUnit.PERCENT
}

export type { IBriefUserItemProgress }
