import { ELanguage } from "@entities/shared/schemas/ELanguage"
import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { isString } from "@shared/functions/checks/isString"

const checkIsLanguageTextFilled = (value: LanguageText | null | undefined) => {
  return [value?.[ELanguage.RUSSIAN], value?.[ELanguage.ENGLISH]].some(
    (translation) => isString(translation) && translation.trim().length > 0,
  )
}

export { checkIsLanguageTextFilled }
