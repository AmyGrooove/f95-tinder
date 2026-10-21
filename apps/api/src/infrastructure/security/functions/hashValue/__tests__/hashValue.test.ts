import { describe, expect, it } from "@jest/globals"
import { compare, getRounds } from "bcryptjs"

import { hashValue } from "../core/hashValue"
import { DICTIONARY } from "@shared/static/DICTIONARY"

describe("hashValue", () => {
  it("создаёт проверяемый bcrypt-хеш с указанным числом раундов и случайной солью", async () => {
    const first = await hashValue("test-password", 4)
    const second = await hashValue("test-password", 4)

    expect(first).not.toBe("test-password")
    expect(first).not.toBe(second)
    expect(getRounds(first)).toBe(4)
    await expect(compare("test-password", first)).resolves.toBe(true)
    await expect(compare("other-password", first)).resolves.toBe(false)
  })

  it("использует 12 раундов по умолчанию", async () => {
    expect(getRounds(await hashValue("test-password"))).toBe(12)
  })

  it("поддерживает пустую строку", async () => {
    await expect(compare("", await hashValue("", 4))).resolves.toBe(true)
  })

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])("отклоняет недопустимое число раундов %s", async (rounds) => {
    await expect(hashValue("value", rounds)).rejects.toThrow(
      new RangeError(DICTIONARY.security.invalidBcryptRounds),
    )
  })
})
