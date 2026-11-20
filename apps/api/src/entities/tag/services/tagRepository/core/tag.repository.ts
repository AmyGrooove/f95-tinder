import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"

import { Tag } from "../../../schemas/tag.schema"
import type { TCreateTag } from "../../../schemas/tag.schema"

@Injectable()
class TagRepository implements OnModuleInit {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

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

  async onModuleInit() {
    await this.model.init()
  }
}

export { TagRepository }
