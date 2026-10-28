import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { Tag } from "../schemas/tag.schema"
import type { TCreateTag } from "../schemas/tag.schema"

@Injectable()
class TagRepository {
  readonly read: MongoReadRepository<Tag, HydratedDocument<Tag>>
  readonly write: MongoWriteRepository<Tag, HydratedDocument<Tag>, TCreateTag>
  readonly pagination: MongoPaginationRepository<Tag, HydratedDocument<Tag>>
  readonly bulk: MongoBulkRepository<Tag, HydratedDocument<Tag>, TCreateTag>
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Tag>>

  constructor(
    @InjectModel(Tag.name) private readonly model: Model<HydratedDocument<Tag>>,
  ) {
    this.read = new MongoReadRepository<Tag, HydratedDocument<Tag>>(model)
    this.write = new MongoWriteRepository<
      Tag,
      HydratedDocument<Tag>,
      TCreateTag
    >(model)
    this.pagination = new MongoPaginationRepository<Tag, HydratedDocument<Tag>>(
      model,
    )
    this.bulk = new MongoBulkRepository<Tag, HydratedDocument<Tag>, TCreateTag>(
      model,
    )
    this.aggregation = new MongoAggregationRepository<HydratedDocument<Tag>>(
      model,
    )
  }

  async initialize() {
    await this.model.init()
  }
}

export { TagRepository }
