import { describe, expect, it } from "@jest/globals"
import { BadRequestException } from "@nestjs/common"
import { Types } from "mongoose"

import { MongoObjectIdHandler } from "../core/mongoObjectId.handler"

describe("MongoObjectIdHandler", () => {
  it("преобразует шестнадцатеричную строку в ObjectId", () => {
    const value = new MongoObjectIdHandler().transform(
      "ABCDEF0123456789ABCDEF01",
    )

    expect(value).toBeInstanceOf(Types.ObjectId)
    expect(value.toHexString()).toBe("abcdef0123456789abcdef01")
  })

  it.each(["", "abcdef0123456789abcdef0", "zbcdef0123456789abcdef01"])(
    "отклоняет некорректный ObjectId %j",
    (value) => {
      expect(() => new MongoObjectIdHandler().transform(value)).toThrow(
        BadRequestException,
      )
    },
  )
})
