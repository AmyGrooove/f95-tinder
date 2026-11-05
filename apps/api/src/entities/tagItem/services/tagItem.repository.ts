import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { AggregateOptions, HydratedDocument, Model } from "mongoose"
import { Tag } from "@entities/tag/schemas/tag.schema"
import type { ICheckTagItemKeysProps } from "../types/ICheckTagItemKeysProps"

import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"

import { TagItem } from "../schemas/tagItem.schema"
import { TagItemWriteRepository } from "./tagItemWrite.repository"
import { TagItemBulkRepository } from "./tagItemBulk.repository"
import { TagItemMutationService } from "./tagItemMutation.service"

@Injectable()
class TagItemRepository {
  readonly read: MongoReadRepository<TagItem, HydratedDocument<TagItem>>
  readonly write: TagItemWriteRepository
  readonly pagination: MongoPaginationRepository<
    TagItem,
    HydratedDocument<TagItem>
  >
  readonly bulk: TagItemBulkRepository
  readonly aggregation: MongoAggregationRepository<HydratedDocument<TagItem>>

  constructor(
    @InjectModel(TagItem.name) model: Model<HydratedDocument<TagItem>>,
    mutations: TagItemMutationService,
  ) {
    this.read = new MongoReadRepository<TagItem, HydratedDocument<TagItem>>(
      model,
    )
    this.write = new TagItemWriteRepository(model, mutations)
    this.pagination = new MongoPaginationRepository<
      TagItem,
      HydratedDocument<TagItem>
    >(model)
    this.bulk = new TagItemBulkRepository(model, mutations)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<TagItem>
    >(model)
  }
  async checkHasTagKeys(
    props: ICheckTagItemKeysProps,
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

export { TagItemRepository }
