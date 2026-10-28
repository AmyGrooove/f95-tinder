import { describe, expect, it } from "@jest/globals"
import { model, Types } from "mongoose"

import { CollectionItemSchema } from "../schemas/collectionItem.schema"

describe("CollectionItemSchema", () => {
  const CollectionItemModel = model(
    "CollectionItemRelevanceValidation",
    CollectionItemSchema,
  )

  it.each([undefined, null, Number.MIN_VALUE, 0.5, 1])(
    "принимает значимость %s и сохраняет null при отсутствии",
    async (relevanceScore) => {
      const document = new CollectionItemModel({
        collectionId: new Types.ObjectId(),
        item: new Types.ObjectId(),
        groupId: new Types.ObjectId(),
        position: 0,
        relevanceScore,
      })

      await expect(document.validate()).resolves.toBeUndefined()
      expect(document.relevanceScore).toBe(relevanceScore ?? null)
    },
  )

  it.each([0, -Number.MIN_VALUE, -1, 1.01, NaN, Infinity, -Infinity])(
    "отклоняет недопустимую значимость %s",
    async (relevanceScore) => {
      const document = new CollectionItemModel({
        collectionId: new Types.ObjectId(),
        item: new Types.ObjectId(),
        groupId: new Types.ObjectId(),
        position: 0,
        relevanceScore,
      })

      await expect(document.validate()).rejects.toMatchObject({
        name: "ValidationError",
        errors: { relevanceScore: expect.anything() },
      })
    },
  )
})
