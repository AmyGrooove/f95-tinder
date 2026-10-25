import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type {
  HydratedDocument,
  Model,
  PipelineStage,
  QueryOptions,
  Types,
} from "mongoose"

import { CollectionItem } from "@entities/collectionItem/schemas/collectionItem.schema"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { Collection } from "../schemas/collection.schema"
import type { TCreateCollection } from "../schemas/collection.schema"
import type { IUpdateCollectionProps } from "../types/IUpdateCollectionProps"
import type { IQueryCollectionsProps } from "../types/IQueryCollectionsProps"
import type { ICollectionSummariesPage } from "../types/ICollectionSummariesPage"
import { ECollectionType } from "../schemas/ECollectionType"

@Injectable()
class CollectionRepository {
  readonly read: MongoReadRepository<Collection, HydratedDocument<Collection>>
  readonly write: MongoWriteRepository<
    Collection,
    HydratedDocument<Collection>,
    TCreateCollection
  >
  readonly pagination: MongoPaginationRepository<
    Collection,
    HydratedDocument<Collection>
  >
  readonly bulk: MongoBulkRepository<
    Collection,
    HydratedDocument<Collection>,
    TCreateCollection
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Collection>>

  constructor(
    @InjectModel(Collection.name) model: Model<HydratedDocument<Collection>>,
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

  async querySummaries(
    props: IQueryCollectionsProps,
  ): Promise<ICollectionSummariesPage> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          deletedAt: null,
          ...(props.type === undefined ? {} : { type: props.type }),
          ...(props.type === ECollectionType.FRANCHISE ? { author: null } : {}),
        },
      },
    ]

    if (props.itemIds !== undefined) {
      pipeline.push(
        {
          $lookup: {
            from: CollectionItem.name,
            let: { collectionId: "$_id" },
            pipeline: [
              {
                $match: {
                  item: { $in: props.itemIds },
                  $expr: { $eq: ["$collectionId", "$$collectionId"] },
                },
              },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            as: "matchingItems",
          },
        },
        { $match: { "matchingItems.0": { $exists: true } } },
      )
    }

    pipeline.push({
      $facet: {
        items: [
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: (props.page - 1) * props.limit },
          { $limit: props.limit },
          { $project: { _id: 1, type: 1, author: 1, title: 1, media: 1 } },
        ],
        count: [{ $count: "total" }],
      },
    })

    const [result] = await this.aggregation.aggregate<{
      items: ICollectionSummariesPage["items"]
      count: { total: number }[]
    }>(pipeline)

    return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0 }
  }

  checkIsNotDeleted(id: Types.ObjectId) {
    return this.read.checkIsExists({ _id: id, deletedAt: null })
  }

  findNotDeletedAuthorById(id: Types.ObjectId) {
    return this.read.findOne(
      { _id: id, deletedAt: null },
      { _id: 1, author: 1 },
    )
  }

  softDeleteByAuthor(id: Types.ObjectId, authorId: Types.ObjectId) {
    return this.write.updateByFilter(
      { _id: id, author: authorId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { projection: { _id: 1 } },
    )
  }

  updateVersioned(
    props: IUpdateCollectionProps,
    options?: Pick<QueryOptions<Collection>, "session">,
  ) {
    return this.write.updateByFilter(
      {
        _id: props.id,
        author: props.authorId,
        deletedAt: null,
        ...(props.version === 0
          ? { $or: [{ version: 0 }, { version: { $exists: false } }] }
          : { version: props.version }),
      },
      { $set: { ...props.changes, version: props.version + 1 } },
      options,
    )
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
}

export { CollectionRepository }
