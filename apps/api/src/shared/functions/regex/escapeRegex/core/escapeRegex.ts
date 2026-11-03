import { REGEX } from "@shared/static/REGEX"

const escapeRegex = (value: string) => {
  return value.replace(REGEX.REGEX_SPECIAL_CHARACTERS, "\\$&")
}

export { escapeRegex }
