import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import {
  ItemRelation,
  ItemRelationSchema,
} from "../../../schemas/itemRelation.schema"
import { ItemRelationRepository } from "../core/itemRelation.repository"

describe("ItemRelationRepository", () => {
  let repository: ItemRelationRepository

  beforeAll(() => {
    repository = new ItemRelationRepository(
      getTestDatabase().connection.model(
        ItemRelation.name,
        ItemRelationSchema,
      ) as unknown as Model<HydratedDocument<ItemRelation>>,
    )
  })

  it("находит кандидатов в обеих позициях связи и исключает повторы, чужие источники и другие роли", async () => {
    const [
      source,
      otherSource,
      firstCandidate,
      secondCandidate,
      wrongCandidate,
      sourceRole,
      candidateRole,
    ] = Array.from({ length: 7 }, () => new Types.ObjectId())
    const first = { item: firstCandidate, role: candidateRole }
    const second = { item: secondCandidate, role: candidateRole }
    const sourceSide = { item: source, role: sourceRole }
    await repository.bulk.createMany([
      { first, second: sourceSide },
      { first: sourceSide, second },
      { first: sourceSide, second: first },
      { first: sourceSide, second: { item: wrongCandidate, role: sourceRole } },
      {
        first: { item: otherSource, role: sourceRole },
        second: { item: wrongCandidate, role: candidateRole },
      },
    ])

    await expect(
      repository.readRelatedItemIds(
        [source],
        [firstCandidate, secondCandidate, wrongCandidate],
        candidateRole,
      ),
    ).resolves.toEqual(
      new Set([firstCandidate.toHexString(), secondCandidate.toHexString()]),
    )
    await expect(
      repository.readRelatedItemIds([source], [], candidateRole),
    ).resolves.toEqual(new Set())
  })
})
