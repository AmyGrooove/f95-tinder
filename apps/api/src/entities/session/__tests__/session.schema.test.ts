import { describe, expect, it } from "@jest/globals"
import { model, Types } from "mongoose"

import { ECountry } from "@entities/shared/schemas/ECountry"

import { SessionSchema } from "../schemas/session.schema"

describe("SessionSchema", () => {
  const SessionModel = model("SessionCountryValidation", SessionSchema)

  it.each([undefined, ECountry.RUSSIA, ECountry.UNKNOWN])(
    "сохраняет страну и применяет unknown по умолчанию: %p",
    async (country) => {
      const document = new SessionModel({
        user: new Types.ObjectId(),
        refreshTokenHash: "hash",
        expiresAt: new Date(Date.now() + 60_000),
        country,
      })

      await expect(document.validate()).resolves.toBeUndefined()
      expect(document.country).toBe(country ?? ECountry.UNKNOWN)
    },
  )

  it.each(["unsupported", null])(
    "отклоняет недопустимую страну: %p",
    async (country) => {
      const document = new SessionModel({
        user: new Types.ObjectId(),
        refreshTokenHash: "hash",
        expiresAt: new Date(Date.now() + 60_000),
        country,
      })

      await expect(document.validate()).rejects.toMatchObject({
        name: "ValidationError",
      })
    },
  )
})
