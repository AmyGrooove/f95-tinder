import { describe, expect, it } from "@jest/globals"
import { hash } from "bcryptjs"

import { compareHash } from "../core/compareHash"

describe("compareHash", () => {
  it.each(["test-password", "", "пароль 🔐"])(
    "распознаёт совпадающее значение %s",
    async (value) => {
      const hashed = await hash(value, 4)

      await expect(compareHash(value, hashed)).resolves.toBe(true)
      await expect(compareHash(`${value}!`, hashed)).resolves.toBe(false)
    },
  )

  it.each(["", "not-a-bcrypt-hash"])(
    "возвращает false для некорректного хеша %s",
    async (hashed) => {
      await expect(compareHash("test-password", hashed)).resolves.toBe(false)
    },
  )
})
