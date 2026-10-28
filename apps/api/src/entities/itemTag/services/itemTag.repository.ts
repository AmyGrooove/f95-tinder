import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { AggregateOptions, HydratedDocument, Model, Types } from "mongoose"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { Item } from "@entities/item/schemas/item.schema"
import type { EItemType } from "@entities/item/schemas/EItemType"
import type { ICheckItemTagKeysProps } from "../types/ICheckItemTagKeysProps"
import type { ITasteItemTag } from "../types/ITasteItemTag"
import type { IGetTasteTagsProps } from "../types/IGetTasteTagsProps"

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

  async getUsageCounts(
    tagIds: readonly Types.ObjectId[],
    itemTypes: readonly EItemType[],
  ) {
    const [result] = await this.aggregation.aggregate<{
      items: { count: number }[]
      tags: { _id: Types.ObjectId; count: number }[]
    }>(
      [
        { $match: { tag: { $in: tagIds } } },
        {
          $lookup: {
            from: Item.name,
            localField: "item",
            foreignField: "_id",
            pipeline: [
              { $match: { deletedAt: null, type: { $in: itemTypes } } },
              { $project: { _id: 1 } },
            ],
            as: "matchedItem",
          },
        },
        { $match: { "matchedItem.0": { $exists: true } } },
        { $group: { _id: "$item", tags: { $addToSet: "$tag" } } },
        {
          $facet: {
            items: [{ $count: "count" }],
            tags: [
              { $unwind: "$tags" },
              { $group: { _id: "$tags", count: { $sum: 1 } } },
            ],
          },
        },
      ],
      { allowDiskUse: true },
    )

    return {
      itemCount: result?.items[0]?.count ?? 0,
      tagCounts: result?.tags ?? [],
    }
  }

  async getTasteTags(props: IGetTasteTagsProps) {
    return await this.aggregation.aggregate<ITasteItemTag>([
      {
        $match: {
          item: { $in: props.itemIds },
          tag: { $in: props.tagIds },
          relevanceScore: { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: Item.name,
          localField: "item",
          foreignField: "_id",
          pipeline: [
            { $match: { deletedAt: null } },
            { $project: { type: 1 } },
          ],
          as: "matchedItem",
        },
      },
      { $unwind: "$matchedItem" },
      {
        $lookup: {
          from: Tag.name,
          localField: "tag",
          foreignField: "_id",
          pipeline: [
            { $match: { group: { $in: props.groups } } },
            { $project: { group: 1 } },
          ],
          as: "matchedTag",
        },
      },
      { $unwind: "$matchedTag" },
      {
        $project: {
          _id: 0,
          item: 1,
          tag: 1,
          itemType: "$matchedItem.type",
          group: "$matchedTag.group",
          relevanceScore: 1,
        },
      },
    ])
  }
}

export { ItemTagRepository }
