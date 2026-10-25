import { isArray } from "@shared/functions/checks/isArray"
import { isNil } from "@shared/functions/checks/isNil"

interface ITastePreference {
  count?: number
  explicitWeight?: number
}

const removeEmptyTastePreferences = <TPreference extends ITastePreference>(
  preferences: TPreference[],
) => {
  if (!isArray(preferences)) {
    return preferences
  }

  return preferences.filter((preference) => {
    return (
      isNil(preference) ||
      (preference.count ?? 0) !== 0 ||
      (preference.explicitWeight ?? 0) !== 0
    )
  })
}

export { removeEmptyTastePreferences }
