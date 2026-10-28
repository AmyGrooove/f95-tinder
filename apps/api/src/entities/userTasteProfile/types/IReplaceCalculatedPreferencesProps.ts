import type { Types } from "mongoose"

import type { TasteTagPreference } from "../schemas/tasteTagPreference.schema"
import type { TCalculatedTasteTagPreference } from "./TCalculatedTasteTagPreference"

interface IReplaceCalculatedPreferencesProps {
  userId: Types.ObjectId
  tagIds: readonly Types.ObjectId[]
  preferences: readonly TCalculatedTasteTagPreference[]
  previousPreferences: readonly TasteTagPreference[] | null
}

export type { IReplaceCalculatedPreferencesProps }
