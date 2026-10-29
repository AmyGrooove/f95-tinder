import { EAgeRestriction } from "@entities/item/schemas/EAgeRestriction"
import { ITEM_FIELD_DEFINITIONS } from "@entities/item/static/ITEM_FIELD_DEFINITIONS"
import { EItemFieldValueType } from "@entities/item/schemas/EItemFieldValueType"
import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type {
  HydratedDocument,
  InsertManyOptions,
  Model,
  MongooseBulkWriteOptions,
  PipelineStage,
} from "mongoose"

import { Item } from "@entities/item/schemas/item.schema"
import { TagItem } from "@entities/tagItem/schemas/tagItem.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { normalizeEmptyStringToNull } from "@entities/shared/functions/setters/normalizeEmptyStringToNull"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { ItemCollection } from "../schemas/itemCollection.schema"
import type { TCreateItemCollection } from "../schemas/itemCollection.schema"
import type { ICreateItemCollectionsProps } from "../types/ICreateItemCollectionsProps"
import type { IItemCollectionsSelectionProps } from "../types/IItemCollectionsSelectionProps"
import type { IRemoveItemCollectionsProps } from "../types/IRemoveItemCollectionsProps"
import type { ICollectionContentSelectionProps } from "../types/ICollectionContentSelectionProps"
import type { ICollectionFilterOptions } from "../types/ICollectionFilterOptions"
import type { IReadItemCollectionsProps } from "../types/IReadItemCollectionsProps"
import type { IItemCollectionsPage } from "../types/IItemCollectionsPage"
import type { ICollectionGroupCount } from "../types/ICollectionGroupCount"
import { createItemCollectionsPipeline } from "../functions/createItemCollectionsPipeline"

@Injectable()
class ItemCollectionRepository {
  readonly read: MongoReadRepository<
    ItemCollection,
    HydratedDocument<ItemCollection>
  >
  readonly write: MongoWriteRepository<
    ItemCollection,
    HydratedDocument<ItemCollection>,
    TCreateItemCollection
  >
  readonly pagination: MongoPaginationRepository<
    ItemCollection,
    HydratedDocument<ItemCollection>
  >
  readonly bulk: MongoBulkRepository<
    ItemCollection,
    HydratedDocument<ItemCollection>,
    TCreateItemCollection
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<ItemCollection>
  >

  constructor(
    @InjectModel(ItemCollection.name)
    model: Model<HydratedDocument<ItemCollection>>,
  ) {
    this.read = new MongoReadRepository<
      ItemCollection,
      HydratedDocument<ItemCollection>
    >(model)
    this.write = new MongoWriteRepository<
      ItemCollection,
      HydratedDocument<ItemCollection>,
      TCreateItemCollection
    >(model)
    this.pagination = new MongoPaginationRepository<
      ItemCollection,
      HydratedDocument<ItemCollection>
    >(model)
    this.bulk = new MongoBulkRepository<
      ItemCollection,
      HydratedDocument<ItemCollection>,
      TCreateItemCollection
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<ItemCollection>
    >(model)
  }

  async readContentPage(props: IReadItemCollectionsProps) {
    const [result] = await this.aggregation.aggregate<IItemCollectionsPage>(
      createItemCollectionsPipeline(props),
      props.sort === "title"
        ? { collation: { locale: props.language, strength: 2 } }
        : undefined,
    )

    return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0 }
  }

  countAvailableItemsByGroup(props: ICollectionContentSelectionProps) {
    return this.aggregation.aggregate<ICollectionGroupCount>([
      {
        $match: {
          collectionId: props.collectionId,
          groupId: { $in: props.groupIds },
        },
      },
      {
        $lookup: {
          from: Item.name,
          localField: "item",
          foreignField: "_id",
          pipeline: [{ $match: { deletedAt: null } }, { $project: { _id: 1 } }],
          as: "itemDocument",
        },
      },
      { $match: { "itemDocument.0": { $exists: true } } },
      { $group: { _id: "$groupId", total: { $sum: 1 } } },
      { $project: { _id: 0, groupId: "$_id", total: 1 } },
    ])
  }

  async getFilterOptions(props: ICollectionContentSelectionProps) {
    const scope: PipelineStage.FacetPipelineStage[] = isUndefined(props.groupId)
      ? []
      : [{ $match: { groupId: props.groupId } }]
    const [result] = await this.aggregation.aggregate<ICollectionFilterOptions>(
      [
        {
          $match: {
            collectionId: props.collectionId,
            groupId: { $in: props.groupIds },
          },
        },
        {
          $lookup: {
            from: Item.name,
            localField: "item",
            foreignField: "_id",
            pipeline: [
              { $match: { deletedAt: null } },
              {
                $project: {
                  _id: 1,
                  releaseDate: 1,
                  ageRestriction: {
                    $convert: {
                      input: {
                        $cond: [
                          {
                            $eq: [
                              "$ageRestriction",
                              EAgeRestriction.AGE_18_PLUS_PLUS,
                            ],
                          },
                          EAgeRestriction.AGE_18,
                          "$ageRestriction",
                        ],
                      },
                      to: "int",
                      onError: null,
                      onNull: null,
                    },
                  },
                  movie: 1,
                  series: 1,
                  game: 1,
                },
              },
            ],
            as: "itemDocument",
          },
        },
        { $unwind: "$itemDocument" },
        {
          $facet: {
            nonEmptyGroups: [{ $group: { _id: "$groupId" } }, { $limit: 2 }],
            tags: [
              ...scope,
              {
                $lookup: {
                  from: TagItem.name,
                  localField: "item",
                  foreignField: "item",
                  pipeline: [{ $project: { tag: 1 } }],
                  as: "tagItems",
                },
              },
              { $unwind: "$tagItems" },
              { $group: { _id: "$tagItems.tag" } },
              {
                $lookup: {
                  from: Tag.name,
                  localField: "_id",
                  foreignField: "_id",
                  pipeline: [
                    { $project: { _id: 1, key: 1, group: 1, name: 1 } },
                  ],
                  as: "tag",
                },
              },
              { $unwind: "$tag" },
              { $replaceRoot: { newRoot: "$tag" } },
              { $sort: { key: 1, _id: 1 } },
            ],
            fields: [
              ...scope,
              {
                $project: {
                  fields: Object.entries(ITEM_FIELD_DEFINITIONS).map(
                    ([field, definition]) => ({
                      field,
                      valueType: definition.valueType,
                      value: `$itemDocument.${field}`,
                    }),
                  ),
                },
              },
              { $unwind: "$fields" },
              {
                $match: {
                  $expr: {
                    $or: [
                      {
                        $and: [
                          {
                            $eq: [
                              "$fields.valueType",
                              EItemFieldValueType.NUMBER,
                            ],
                          },
                          { $isNumber: "$fields.value" },
                          { $gte: ["$fields.value", -Number.MAX_VALUE] },
                          { $lte: ["$fields.value", Number.MAX_VALUE] },
                        ],
                      },
                      {
                        $and: [
                          {
                            $eq: [
                              "$fields.valueType",
                              EItemFieldValueType.DATE,
                            ],
                          },
                          { $eq: [{ $type: "$fields.value" }, "date"] },
                        ],
                      },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: "$fields.field",
                  valueType: { $first: "$fields.valueType" },
                  min: { $min: "$fields.value" },
                  max: { $max: "$fields.value" },
                },
              },
              {
                $project: {
                  _id: 0,
                  field: "$_id",
                  valueType: 1,
                  min: 1,
                  max: 1,
                },
              },
              { $sort: { field: 1 } },
            ],
          },
        },
        {
          $project: {
            nonEmptyGroupIds: "$nonEmptyGroups._id",
            tags: 1,
            fields: 1,
          },
        },
      ],
    )

    return result ?? { nonEmptyGroupIds: [], tags: [], fields: [] }
  }

  findByCollectionAndItems(
    props: IItemCollectionsSelectionProps,
    options?: Pick<MongooseBulkWriteOptions, "session">,
  ) {
    return this.read.findMany(
      { collectionId: props.collectionId, item: { $in: props.itemIds } },
      { _id: 1, item: 1 },
      options,
    )
  }

  upsertForCollection(
    props: ICreateItemCollectionsProps,
    options?: Pick<MongooseBulkWriteOptions, "session">,
  ) {
    return this.bulk.bulkWrite(
      props.items.map((item) => ({
        updateOne: {
          filter: { collectionId: props.collectionId, item: item.item },
          update: {
            $set: {
              groupId: item.groupId,
              position: item.position,
              ...(!isUndefined(item.relevanceScore)
                ? { relevanceScore: item.relevanceScore }
                : {}),
              ...(!isUndefined(item.note)
                ? {
                    note: normalizeEmptyStringToNull(item.note?.trim() ?? null),
                  }
                : {}),
            },
            $setOnInsert: {
              collectionId: props.collectionId,
              item: item.item,
            },
          },
          upsert: true,
        },
      })),
      options,
    )
  }

  removeForCollection(
    props: IRemoveItemCollectionsProps,
    options?: Pick<MongooseBulkWriteOptions, "session">,
  ) {
    return this.bulk.deleteMany(
      {
        collectionId: props.collectionId,
        $or: [
          { item: { $in: props.itemIds } },
          { groupId: { $in: props.groupIds } },
        ],
      },
      options,
    )
  }

  createForCollection(
    props: ICreateItemCollectionsProps,
    options?: Pick<InsertManyOptions, "session">,
  ) {
    return this.bulk.createMany(
      props.items.map((item) => ({
        ...item,
        collectionId: props.collectionId,
      })),
      options ?? {},
    )
  }
}

export { ItemCollectionRepository }
