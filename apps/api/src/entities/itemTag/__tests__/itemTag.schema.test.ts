import { describe, expect, it } from "@jest/globals"
import { Mongoose, Types } from "mongoose"

import { ItemTagSchema } from "../schemas/itemTag.schema"
import type { ItemTag } from "../schemas/itemTag.schema"

describe("ItemTagSchema", () => {
  const model = new Mongoose().model<ItemTag>("ItemTagUnit", ItemTagSchema)

  it.each([Number.MIN_VALUE, 0.01, 1])(
    "сохраняет положительную значимость %s без дополнительного порога",
    async (relevanceScore) => {
      const record = new model({
        item: new Types.ObjectId(),
        tag: new Types.ObjectId(),
        relevanceScore,
      })

      await expect(record.validate()).resolves.toBeUndefined()
      expect(record.relevanceScore).toBe(relevanceScore)
    },
  )

  it.each([
    0,
    -0.01,
    1.01,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    null,
    undefined,
  ])("отклоняет недопустимую значимость %s", async (relevanceScore) => {
    const record = new model({
      item: new Types.ObjectId(),
      tag: new Types.ObjectId(),
      relevanceScore,
    })

    await expect(record.validate()).rejects.toThrow()
    expect(record.item).toBeDefined()
    expect(record.tag).toBeDefined()
  })
})
