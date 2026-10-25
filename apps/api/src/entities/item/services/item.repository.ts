import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, QueryOptions, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { Item } from "../schemas/item.schema"
import type { TCreateItem } from "../schemas/item.schema"
import type { IItemDetails } from "../types/IItemDetails"

@Injectable()
class ItemRepository {
  readonly read: MongoReadRepository<Item, HydratedDocument<Item>>
  readonly write: MongoWriteRepository<
    Item,
    HydratedDocument<Item>,
    TCreateItem
  >
  readonly pagination: MongoPaginationRepository<Item, HydratedDocument<Item>>
  readonly bulk: MongoBulkRepository<Item, HydratedDocument<Item>, TCreateItem>
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Item>>

  constructor(@InjectModel(Item.name) model: Model<HydratedDocument<Item>>) {
    this.read = new MongoReadRepository<Item, HydratedDocument<Item>>(model)
    this.write = new MongoWriteRepository<
      Item,
      HydratedDocument<Item>,
      TCreateItem
    >(model)
    this.pagination = new MongoPaginationRepository<
      Item,
      HydratedDocument<Item>
    >(model)
    this.bulk = new MongoBulkRepository<
      Item,
      HydratedDocument<Item>,
      TCreateItem
    >(model)
    this.aggregation = new MongoAggregationRepository<HydratedDocument<Item>>(
      model,
    )
  }

  findNotDeletedByIds(
    ids: Types.ObjectId[],
    options?: Pick<QueryOptions<Item>, "session">,
  ) {
    return this.read.findMany(
      { _id: { $in: ids }, deletedAt: null },
      { _id: 1 },
      options,
    )
  }

  async findDetailsById(id: Types.ObjectId): Promise<IItemDetails | null> {
    const [item] = await this.aggregation.aggregate<IItemDetails>([
      { $match: { _id: id, deletedAt: null } },
      {
        $project: {
          _id: 1,
          type: 1,
          title: 1,
          description: 1,
          aliases: 1,
          media: 1,
        },
      },
      {
        $lookup: {
          from: "ItemTag",
          localField: "_id",
          foreignField: "item",
          pipeline: [
            {
              $lookup: {
                from: "Tag",
                localField: "tag",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, key: 1, group: 1, name: 1 } }],
                as: "tag",
              },
            },
            { $unwind: "$tag" },
            { $sort: { relevanceScore: -1, "tag._id": 1 } },
            { $replaceWith: "$tag" },
          ],
          as: "tags",
        },
      },
      {
        $lookup: {
          from: "ItemFeature",
          localField: "_id",
          foreignField: "item",
          pipeline: [
            {
              $lookup: {
                from: "Feature",
                localField: "feature",
                foreignField: "_id",
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      key: 1,
                      name: 1,
                      valueType: 1,
                      unit: 1,
                    },
                  },
                ],
                as: "feature",
              },
            },
            { $unwind: "$feature" },
            { $sort: { "feature.key": 1 } },
            {
              $replaceWith: {
                $mergeObjects: ["$feature", { value: "$value" }],
              },
            },
          ],
          as: "features",
        },
      },
      {
        $lookup: {
          from: "Relation",
          pipeline: [
            {
              $match: {
                $or: [{ "first.item": id }, { "second.item": id }],
              },
            },
            {
              $project: {
                side: {
                  $cond: [{ $eq: ["$first.item", id] }, "$second", "$first"],
                },
              },
            },
            {
              $lookup: {
                from: "Item",
                localField: "side.item",
                foreignField: "_id",
                pipeline: [
                  { $match: { deletedAt: null } },
                  { $project: { _id: 1, type: 1, title: 1, media: 1 } },
                ],
                as: "item",
              },
            },
            { $unwind: "$item" },
            {
              $lookup: {
                from: "ItemRelationRole",
                localField: "side.role",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1, key: 1, name: 1 } }],
                as: "role",
              },
            },
            { $unwind: "$role" },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                item: 1,
                role: 1,
                roleNameOverride: "$side.roleNameOverride",
              },
            },
          ],
          as: "relations",
        },
      },
    ])

    return item ?? null
  }
}

export { ItemRepository }
