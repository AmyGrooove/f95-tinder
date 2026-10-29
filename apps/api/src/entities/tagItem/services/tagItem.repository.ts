import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { AggregateOptions, HydratedDocument, Model, Types } from "mongoose"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { Item } from "@entities/item/schemas/item.schema"
import type { EItemType } from "@entities/item/schemas/EItemType"
import type { ICheckTagItemKeysProps } from "../types/ICheckTagItemKeysProps"
import type { ITasteTagItem } from "../types/ITasteTagItem"
import type { IGetTasteTagsProps } from "../types/IGetTasteTagsProps"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

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
    return await this.aggregation.aggregate<ITasteTagItem>([
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

export { TagItemRepository }
