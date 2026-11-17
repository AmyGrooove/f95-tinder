import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"

import { ItemRelation } from "../../../schemas/itemRelation.schema"
import type { TCreateItemRelation } from "../../../schemas/itemRelation.schema"

@Injectable()
class ItemRelationRepository {
  readonly read: MongoReadRepository<
    ItemRelation,
    HydratedDocument<ItemRelation>
  >
  readonly write: MongoWriteRepository<
    ItemRelation,
    HydratedDocument<ItemRelation>,
    TCreateItemRelation
  >
  readonly pagination: MongoPaginationRepository<
    ItemRelation,
    HydratedDocument<ItemRelation>
  >
  readonly bulk: MongoBulkRepository<
    ItemRelation,
    HydratedDocument<ItemRelation>,
    TCreateItemRelation
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<ItemRelation>
  >

  constructor(
    @InjectModel(ItemRelation.name)
    model: Model<HydratedDocument<ItemRelation>>,
  ) {
    this.read = new MongoReadRepository<
      ItemRelation,
      HydratedDocument<ItemRelation>
    >(model)
    this.write = new MongoWriteRepository<
      ItemRelation,
      HydratedDocument<ItemRelation>,
      TCreateItemRelation
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemRelation,
      HydratedDocument<ItemRelation>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemRelation,
      HydratedDocument<ItemRelation>,
      TCreateItemRelation
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemRelation>
    >(model)
  }

  async readRelatedItemIds(
    sourceIds: readonly Types.ObjectId[],
    candidateIds: readonly Types.ObjectId[],
    candidateRole: Types.ObjectId,
  ) {
    const links = await this.read.findMany(
      {
        $or: [
          {
            "first.item": { $in: sourceIds },
            "second.item": { $in: candidateIds },
            "second.role": candidateRole,
          },
          {
            "second.item": { $in: sourceIds },
            "first.item": { $in: candidateIds },
            "first.role": candidateRole,
          },
        ],
      },
      { first: 1, second: 1 },
      { lean: true },
    )
    const sources = new Set(sourceIds.map((id) => id.toHexString()))
    const candidates = new Set(candidateIds.map((id) => id.toHexString()))
    const related = new Set<string>()

    for (const { first, second } of links) {
      for (const [source, candidate] of [
        [first, second],
        [second, first],
      ]) {
        const candidateId = candidate.item.toHexString()

        if (
          candidateRole.equals(candidate.role) &&
          sources.has(source.item.toHexString()) &&
          candidates.has(candidateId)
        ) {
          related.add(candidateId)
        }
      }
    }

    return related
  }
}

export { ItemRelationRepository }
