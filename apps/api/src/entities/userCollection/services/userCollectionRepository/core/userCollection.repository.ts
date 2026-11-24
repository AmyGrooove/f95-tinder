import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { mongo } from "mongoose"
import type { HydratedDocument, Model, Types } from "mongoose"

import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"

import { UserCollection } from "../../../schemas/userCollection.schema"
import type { TCreateUserCollection } from "../../../schemas/userCollection.schema"
import type { IUpsertUserCollectionReactionProps } from "../types/IUpsertUserCollectionReactionProps"

@Injectable()
class UserCollectionRepository {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

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

  findByUserAndCollection(
    userId: Types.ObjectId,
    collectionId: Types.ObjectId,
  ) {
    return this.read.findOne(
      { user: userId, collectionId },
      { _id: 0, isFavorite: 1, rating: 1, isHidden: 1 },
    )
  }

  async readFavoriteCollectionIds(userId: Types.ObjectId) {
    const reactions = await this.read.findMany(
      { user: userId, isFavorite: true },
      { _id: 0, collectionId: 1 },
      { lean: true },
    )

    return reactions.map((reaction) => {
      const { collectionId } = reaction

      return collectionId.toHexString()
    })
  }

  async readStatistics(collectionId: Types.ObjectId) {
    const pipeline = new AggregationBuilder()
      .match({ collectionId })
      .use({
        $group: {
          _id: null,
          ratingAverage: { $avg: "$rating" },
          ratingsCount: { $sum: { $cond: [{ $isNumber: "$rating" }, 1, 0] } },
          favoritesCount: {
            $sum: { $cond: [{ $eq: ["$isFavorite", true] }, 1, 0] },
          },
        },
      })
      .project({ _id: 0, ratingAverage: 1, ratingsCount: 1, favoritesCount: 1 })
      .build()
    const [statistics] = await this.aggregation.aggregate<{
      ratingAverage: number | null
      ratingsCount: number
      favoritesCount: number
    }>(pipeline)

    return (
      statistics ?? { ratingAverage: null, ratingsCount: 0, favoritesCount: 0 }
    )
  }

  async upsertReaction(props: IUpsertUserCollectionReactionProps) {
    const { userId, collectionId, reaction } = props

    const filter = { user: userId, collectionId }
    const update = { $set: reaction }
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
        error.keyPattern?.collectionId === 1
      ) {
        return this.write.updateByFilter(filter, update, { projection })
      }

      throw error
    }
  }
}

export { UserCollectionRepository }
