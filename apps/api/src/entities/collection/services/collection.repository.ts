import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, QueryOptions, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { Collection } from "../schemas/collection.schema"
import type { TCreateCollection } from "../schemas/collection.schema"
import type { IUpdateCollectionProps } from "../types/IUpdateCollectionProps"

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
