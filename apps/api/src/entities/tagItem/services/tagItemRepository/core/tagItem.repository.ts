import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { AggregateOptions, HydratedDocument, Model } from "mongoose"

import { TagItemBulkRepository } from "@entities/tagItem/services/tagItemBulkRepository"
import { TagItemMutationService } from "@entities/tagItem/services/tagItemMutationService"
import { TagItemWriteRepository } from "@entities/tagItem/services/tagItemWriteRepository"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"

import { TagItem } from "../../../schemas/tagItem.schema"
import { createMatchedTagKeysLookup } from "../functions/aggregationPipelines/createMatchedTagKeysLookup"
import type { ICheckTagItemKeysProps } from "../types/ICheckTagItemKeysProps"

@Injectable()
class TagItemRepository {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

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
    const { itemId, group, keys } = props

    const pipeline = new AggregationBuilder()
      .match({ item: itemId })
      .use(createMatchedTagKeysLookup(group, keys))
      .match({ "matchedTag.0": { $exists: true } })
      .limit(1)
      .project({ _id: 1 })
      .build()

    const records = await this.aggregation.aggregate<{ _id: unknown }>(
      pipeline,
      options,
    )

    return records.length > 0
  }
}

export { TagItemRepository }
