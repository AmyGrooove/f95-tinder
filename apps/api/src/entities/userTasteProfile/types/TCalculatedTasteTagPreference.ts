import type { TasteTagPreference } from "../schemas/tasteTagPreference.schema"

type TCalculatedTasteTagPreference = Pick<
  TasteTagPreference,
  "tag" | "weight" | "count"
>

export type { TCalculatedTasteTagPreference }
