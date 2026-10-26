import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { AggregateOptions, HydratedDocument, Model } from "mongoose"
import { Tag } from "@entities/tag/schemas/tag.schema"
import type { ICheckItemTagKeysProps } from "../types/ICheckItemTagKeysProps"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { ItemTag } from "../schemas/itemTag.schema"
import type { TCreateItemTag } from "../schemas/itemTag.schema"

@Injectable()
class ItemTagRepository {
  readonly read: MongoReadRepository<ItemTag, HydratedDocument<ItemTag>>
  readonly write: MongoWriteRepository<
    ItemTag,
    HydratedDocument<ItemTag>,
    TCreateItemTag
  >
  readonly pagination: MongoPaginationRepository<
    ItemTag,
    HydratedDocument<ItemTag>
  >
  readonly bulk: MongoBulkRepository<
    ItemTag,
    HydratedDocument<ItemTag>,
    TCreateItemTag
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<ItemTag>>

  constructor(
    @InjectModel(ItemTag.name) model: Model<HydratedDocument<ItemTag>>,
  ) {
    this.read = new MongoReadRepository<ItemTag, HydratedDocument<ItemTag>>(
      model,
    )
    this.write = new MongoWriteRepository<
      ItemTag,
      HydratedDocument<ItemTag>,
      TCreateItemTag
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemTag,
      HydratedDocument<ItemTag>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemTag,
      HydratedDocument<ItemTag>,
      TCreateItemTag
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemTag>
    >(model)
  }
  async checkHasTagKeys(
    props: ICheckItemTagKeysProps,
    options?: Pick<AggregateOptions, "session">,
  ) {
    const records = await this.aggregation.aggregate<{ _id: unknown }>(
      [
        { $match: { item: props.itemId } },
        {
          $lookup: {
            from: Tag.name,
            localField: "tag",
            foreignField: "_id",
            pipeline: [
              { $match: { group: props.group, key: { $in: props.keys } } },
              { $project: { _id: 1 } },
            ],
            as: "matchedTag",
          },
        },
        { $match: { "matchedTag.0": { $exists: true } } },
        { $limit: 1 },
        { $project: { _id: 1 } },
      ],
      options,
    )

    return records.length > 0
  }
}

export { ItemTagRepository }
