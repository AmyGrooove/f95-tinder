import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { mongo, Types } from "mongoose"
import type { HydratedDocument, Model, QueryOptions } from "mongoose"

import type { LanguageText } from "@entities/shared/schemas/languageText.schema"
import { UserCollection } from "@entities/userCollection/schemas/userCollection.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { isNil } from "@shared/functions/checks/isNil"

import { Collection } from "../../../schemas/collection.schema"
import type { TCreateCollection } from "../../../schemas/collection.schema"
import { ECollectionBlockType } from "../../../schemas/ECollectionBlockType"
import { ECollectionType } from "../../../schemas/ECollectionType"
import { createAvailableCollectionMembershipLookup } from "../functions/aggregationPipelines/createAvailableCollectionMembershipLookup"
import type { IUpdateCollectionProps } from "../types/IUpdateCollectionProps"

@Injectable()
class CollectionRepository implements OnModuleInit {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

  constructor(
    @InjectModel(Collection.name)
    private readonly model: Model<HydratedDocument<Collection>>,
  ) {
    this.read = new MongoReadRepository<
      Collection,
      HydratedDocument<Collection>
    >(model)
    this.write = new MongoWriteRepository<
      Collection,
      HydratedDocument<Collection>,
      TCreateCollection
    >(model)
    this.pagination = new MongoPaginationRepository<
      Collection,
      HydratedDocument<Collection>
    >(model)
    this.bulk = new MongoBulkRepository<
      Collection,
      HydratedDocument<Collection>,
      TCreateCollection
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<Collection>
    >(model)
  }

  async onModuleInit() {
    await this.model.init()
  }

  findNotDeletedById(
    id: Types.ObjectId,
    options?: Pick<QueryOptions<Collection>, "session">,
  ) {
    return this.read.findOne(
      { _id: id, deletedAt: null },
      {
        _id: 1,
        version: 1,
        title: 1,
        description: 1,
        media: 1,
        author: 1,
        type: 1,
        blocks: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      options,
    )
  }

  findNotDeletedAuthorById(id: Types.ObjectId) {
    return this.read.findOne(
      { _id: id, deletedAt: null },
      { _id: 1, author: 1 },
    )
  }

  checkIsNotDeleted(id: Types.ObjectId) {
    return this.read.checkIsExists({ _id: id, deletedAt: null })
  }

  sampleAvailableSiteCollectionIds(limit: number) {
    return this.aggregation.aggregate<Pick<Collection, "_id">>(
      new AggregationBuilder()
        .match({
          author: null,
          deletedAt: null,
          type: { $in: [ECollectionType.TAG, ECollectionType.FEATURE] },
        })
        .project({ _id: 1, blocks: 1 })
        .use(createAvailableCollectionMembershipLookup())
        .match({ "availableMembership.0": { $exists: true } })
        .project({ _id: 1 })
        .use({ $sample: { size: limit } })
        .build(),
    )
  }

  readAvailableItemCountsByIds(ids: Types.ObjectId[]) {
    return this.aggregation.aggregate<{
      _id: Types.ObjectId
      itemCount: number
    }>(
      new AggregationBuilder()
        .match({ _id: { $in: ids }, deletedAt: null })
        .project({ _id: 1, blocks: 1 })
        .use(
          createAvailableCollectionMembershipLookup({ isCountRequested: true }),
        )
        .project({
          _id: 1,
          itemCount: {
            $ifNull: [{ $first: "$availableMembership.itemCount" }, 0],
          },
        })
        .build(),
    )
  }

  async readRatingAveragesByIds(ids: Types.ObjectId[]) {
    if (ids.length === 0) {
      return new Map<string, number | null>()
    }

    const rows = await this.aggregation.aggregate<{
      _id: Types.ObjectId
      ratingAverage: number | null
    }>(
      new AggregationBuilder()
        .match({ _id: { $in: ids }, deletedAt: null })
        .project({ _id: 1 })
        .use({
          $lookup: {
            from: UserCollection.name,
            localField: "_id",
            foreignField: "collectionId",
            pipeline: [{ $group: { _id: null, average: { $avg: "$rating" } } }],
            as: "ratings",
          },
        })
        .project({
          _id: 1,
          ratingAverage: { $ifNull: [{ $first: "$ratings.average" }, null] },
        })
        .build(),
    )

    return new Map(
      rows.map((rating) => {
        const { _id, ratingAverage } = rating

        return [String(_id), ratingAverage]
      }),
    )
  }

  async ensureForTag(tag: Types.ObjectId, title: LanguageText) {
    const filter = { tag, type: ECollectionType.TAG, author: null }
    const now = new Date()

    try {
      return await this.write.updateByFilter(
        filter,
        {
          $setOnInsert: {
            ...filter,
            title,
            createdAt: now,
            updatedAt: now,
            blocks: [
              { id: new Types.ObjectId(), type: ECollectionBlockType.GROUP },
            ],
          },
        },
        { upsert: true, timestamps: false },
      )
    } catch (error) {
      if (
        error instanceof mongo.MongoServerError &&
        error.code === 11000 &&
        error.keyPattern?.tag === 1
      ) {
        const existing = await this.read.findOne(filter)

        if (!isNil(existing)) {
          return existing
        }
      }

      throw error
    }
  }

  updateVersioned(
    props: IUpdateCollectionProps,
    options?: Pick<QueryOptions<Collection>, "session">,
  ) {
    const { id, authorId, version, changes } = props

    return this.write.updateByFilter(
      {
        _id: id,
        author: authorId,
        deletedAt: null,
        ...(version === 0
          ? { $or: [{ version: 0 }, { version: { $exists: false } }] }
          : { version }),
      },
      { $set: { ...changes, version: version + 1 } },
      options,
    )
  }

  softDeleteByAuthor(id: Types.ObjectId, authorId: Types.ObjectId) {
    return this.write.updateByFilter(
      { _id: id, author: authorId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { projection: { _id: 1 } },
    )
  }
}

export { CollectionRepository }
