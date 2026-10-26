import { TAG_GROUP_RULES } from "../../../static/TAG_GROUP_RULES"
import type { TTagGroupRule } from "../../../types/TTagGroupRule"
import type { ICheckIsTagKeyAllowedProps } from "../types/ICheckIsTagKeyAllowedProps"
import { isNil } from "@shared/functions/checks/isNil"
import { isString } from "@shared/functions/checks/isString"

const checkIsTagKeyAllowed = ({ key, group }: ICheckIsTagKeyAllowedProps) => {
  if (!isString(key)) {
    return false
  }

  if (isNil(group)) {
    return true
  }

  const rule: TTagGroupRule = TAG_GROUP_RULES[group]

  if (isNil(rule)) {
    return false
  }

  switch (rule.kind) {
    case "dictionary":
      return isNil(rule.values) || rule.values.includes(key)
    case "enum":
      return rule.values.some((entry) => entry.key === key)
    case "range":
      return rule.ranges.some((range) => range.key === key)
    case "integer": {
      if (!key.startsWith(group)) {
        return false
      }

      const suffix = key.slice(group.length)
      const value = Number(suffix)

      return (
        String(value) === suffix &&
        Number.isSafeInteger(value) &&
        value >= rule.min &&
        value <= rule.max
      )
    }
  }
}

export { checkIsTagKeyAllowed }
