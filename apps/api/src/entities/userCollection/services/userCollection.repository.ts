import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { mongo } from "mongoose"
import type { HydratedDocument, Model, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { UserCollection } from "../schemas/userCollection.schema"
import type { TCreateUserCollection } from "../schemas/userCollection.schema"
import type { IUpsertUserCollectionReactionProps } from "../types/IUpsertUserCollectionReactionProps"

@Injectable()
class UserCollectionRepository {
  readonly read: MongoReadRepository<
    UserCollection,
    HydratedDocument<UserCollection>
  >
  readonly write: MongoWriteRepository<
    UserCollection,
    HydratedDocument<UserCollection>,
    TCreateUserCollection
  >
  readonly pagination: MongoPaginationRepository<
    UserCollection,
    HydratedDocument<UserCollection>
  >
  readonly bulk: MongoBulkRepository<
    UserCollection,
    HydratedDocument<UserCollection>,
    TCreateUserCollection
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<UserCollection>
  >

  constructor(
    @InjectModel(UserCollection.name)
    model: Model<HydratedDocument<UserCollection>>,
  ) {
    this.read = new MongoReadRepository<
      UserCollection,
      HydratedDocument<UserCollection>
    >(model)
    this.write = new MongoWriteRepository<
      UserCollection,
      HydratedDocument<UserCollection>,
      TCreateUserCollection
    >(model)
    this.pagination = new MongoPaginationRepository<
      UserCollection,
      HydratedDocument<UserCollection>
    >(model)
    this.bulk = new MongoBulkRepository<
      UserCollection,
      HydratedDocument<UserCollection>,
      TCreateUserCollection
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<UserCollection>
    >(model)
  }

  async upsertReaction(props: IUpsertUserCollectionReactionProps) {
    const filter = { user: props.userId, collection: props.collectionId }
    const update = { $set: props.reaction }
    const projection = { _id: 0, isFavorite: 1, rating: 1, isHidden: 1 }

    try {
      return await this.write.updateByFilter(filter, update, {
        upsert: true,
        setDefaultsOnInsert: true,
        projection,
      })
    } catch (error) {
      if (
        error instanceof mongo.MongoServerError &&
        error.code === 11000 &&
        error.keyPattern?.user === 1 &&
        error.keyPattern?.collection === 1
      ) {
        return this.write.updateByFilter(filter, update, { projection })
      }

      throw error
    }
  }

  findByUserAndCollection(
    userId: Types.ObjectId,
    collectionId: Types.ObjectId,
  ) {
    return this.read.findOne(
      { user: userId, collection: collectionId },
      { _id: 0, isFavorite: 1, rating: 1, isHidden: 1 },
    )
  }
}

export { UserCollectionRepository }
