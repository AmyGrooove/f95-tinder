import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model, QueryOptions, Types } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"

import { Item } from "../../../schemas/item.schema"
import type { TCreateItem } from "../../../schemas/item.schema"
import type { IItemDetails } from "../types/IItemDetails"
import { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import type { IItemSearchIndexEntry } from "../types/IItemSearchIndexEntry"
import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"
import type { IReadSearchIndexBatchProps } from "../types/IReadSearchIndexBatchProps"

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

  readSearchIndexBatch(props: IReadSearchIndexBatchProps) {
    const { limit, afterId } = props

    return this.aggregation.aggregate<IItemSearchIndexEntry>([
      {
        $match: !isUndefined(afterId) ? { _id: { $gt: afterId } } : {},
      },
      { $sort: { _id: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: TagItem.name,
          localField: "_id",
          foreignField: "item",
          pipeline: [
            {
              $lookup: {
                from: Tag.name,
                localField: "tag",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 1 } }],
                as: "existingTag",
              },
            },
            { $match: { "existingTag.0": { $exists: true } } },
            { $project: { tag: 1 } },
          ],
          as: "searchTags",
        },
      },
      {
        $lookup: {
          from: ItemStats.name,
          localField: "_id",
          foreignField: "item",
          pipeline: [{ $project: { ratingAverage: 1, ratingsCount: 1 } }],
          as: "searchMetrics",
        },
      },
      {
        $project: {
          _id: 1,
          type: 1,
          title: 1,
          aliases: 1,
          description: 1,
          media: 1,
          releaseDate: 1,
          ageRestriction: 1,
          movie: 1,
          series: 1,
          game: 1,
          deletedAt: 1,
          tagIds: "$searchTags.tag",
          ratingsCount: {
            $ifNull: [{ $arrayElemAt: ["$searchMetrics.ratingsCount", 0] }, 0],
          },
          rating: {
            $ifNull: [
              { $arrayElemAt: ["$searchMetrics.ratingAverage", 0] },
              null,
            ],
          },
        },
      },
    ])
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
          releaseDate: 1,
          ageRestriction: 1,
          movie: 1,
          series: 1,
          game: 1,
        },
      },
      {
        $lookup: {
          from: "TagItem",
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
          from: "ItemRelation",
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
                from: "Relation",
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
