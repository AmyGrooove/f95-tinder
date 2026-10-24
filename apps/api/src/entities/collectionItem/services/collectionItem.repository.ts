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
import { ItemTag } from "@entities/itemTag/schemas/itemTag.schema"
import { Tag } from "@entities/tag/schemas/tag.schema"
import { ItemFeature } from "@entities/itemFeature/schemas/itemFeature.schema"
import { Feature } from "@entities/feature/schemas/feature.schema"
import { EFeatureValueType } from "@entities/feature/schemas/EFeatureValueType"
import { normalizeEmptyStringToNull } from "@entities/shared/functions/setters/normalizeEmptyStringToNull"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { CollectionItem } from "../schemas/collectionItem.schema"
import type { TCreateCollectionItem } from "../schemas/collectionItem.schema"
import type { ICreateCollectionItemsProps } from "../types/ICreateCollectionItemsProps"
import type { ICollectionItemsSelectionProps } from "../types/ICollectionItemsSelectionProps"
import type { IRemoveCollectionItemsProps } from "../types/IRemoveCollectionItemsProps"
import type { ICollectionContentSelectionProps } from "../types/ICollectionContentSelectionProps"
import type { ICollectionFilterOptions } from "../types/ICollectionFilterOptions"
import type { IReadCollectionItemsProps } from "../types/IReadCollectionItemsProps"
import type { ICollectionItemsPage } from "../types/ICollectionItemsPage"
import type { ICollectionGroupCount } from "../types/ICollectionGroupCount"
import { createCollectionItemsPipeline } from "../functions/createCollectionItemsPipeline"

@Injectable()
class CollectionItemRepository {
  readonly read: MongoReadRepository<
    CollectionItem,
    HydratedDocument<CollectionItem>
  >
  readonly write: MongoWriteRepository<
    CollectionItem,
    HydratedDocument<CollectionItem>,
    TCreateCollectionItem
  >
  readonly pagination: MongoPaginationRepository<
    CollectionItem,
    HydratedDocument<CollectionItem>
  >
  readonly bulk: MongoBulkRepository<
    CollectionItem,
    HydratedDocument<CollectionItem>,
    TCreateCollectionItem
  >
  readonly aggregation: MongoAggregationRepository<
    HydratedDocument<CollectionItem>
  >

  constructor(
    @InjectModel(CollectionItem.name)
    model: Model<HydratedDocument<CollectionItem>>,
  ) {
    this.read = new MongoReadRepository<
      CollectionItem,
      HydratedDocument<CollectionItem>
    >(model)
    this.write = new MongoWriteRepository<
      CollectionItem,
      HydratedDocument<CollectionItem>,
      TCreateCollectionItem
    >(model)
    this.pagination = new MongoPaginationRepository<
      CollectionItem,
      HydratedDocument<CollectionItem>
    >(model)
    this.bulk = new MongoBulkRepository<
      CollectionItem,
      HydratedDocument<CollectionItem>,
      TCreateCollectionItem
    >(model)
    this.aggregation = new MongoAggregationRepository<
      HydratedDocument<CollectionItem>
    >(model)
  }

  async readContentPage(props: IReadCollectionItemsProps) {
    const [result] = await this.aggregation.aggregate<ICollectionItemsPage>(
      createCollectionItemsPipeline(props),
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
              { $project: { _id: 1 } },
            ],
            as: "itemDocument",
          },
        },
        { $match: { "itemDocument.0": { $exists: true } } },
        {
          $facet: {
            nonEmptyGroups: [{ $group: { _id: "$groupId" } }, { $limit: 2 }],
            tags: [
              ...scope,
              {
                $lookup: {
                  from: ItemTag.name,
                  localField: "item",
                  foreignField: "item",
                  pipeline: [{ $project: { tag: 1 } }],
                  as: "itemTags",
                },
              },
              { $unwind: "$itemTags" },
              { $group: { _id: "$itemTags.tag" } },
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
            features: [
              ...scope,
              {
                $lookup: {
                  from: ItemFeature.name,
                  localField: "item",
                  foreignField: "item",
                  pipeline: [{ $project: { feature: 1, value: 1 } }],
                  as: "itemFeatures",
                },
              },
              { $unwind: "$itemFeatures" },
              {
                $lookup: {
                  from: Feature.name,
                  localField: "itemFeatures.feature",
                  foreignField: "_id",
                  pipeline: [
                    {
                      $project: {
                        _id: 1,
                        key: 1,
                        group: 1,
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
              {
                $match: {
                  $expr: {
                    $or: [
                      {
                        $and: [
                          {
                            $eq: [
                              "$feature.valueType",
                              EFeatureValueType.NUMBER,
                            ],
                          },
                          { $isNumber: "$itemFeatures.value" },
                          { $gte: ["$itemFeatures.value", -Number.MAX_VALUE] },
                          { $lte: ["$itemFeatures.value", Number.MAX_VALUE] },
                        ],
                      },
                      {
                        $and: [
                          {
                            $eq: [
                              "$feature.valueType",
                              EFeatureValueType.BOOLEAN,
                            ],
                          },
                          { $eq: [{ $type: "$itemFeatures.value" }, "bool"] },
                        ],
                      },
                      {
                        $and: [
                          {
                            $eq: ["$feature.valueType", EFeatureValueType.DATE],
                          },
                          { $eq: [{ $type: "$itemFeatures.value" }, "date"] },
                        ],
                      },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: "$feature._id",
                  key: { $first: "$feature.key" },
                  group: { $first: "$feature.group" },
                  name: { $first: "$feature.name" },
                  valueType: { $first: "$feature.valueType" },
                  unit: { $first: "$feature.unit" },
                  min: { $min: "$itemFeatures.value" },
                  max: { $max: "$itemFeatures.value" },
                  values: {
                    $addToSet: {
                      $cond: [
                        {
                          $eq: [
                            "$feature.valueType",
                            EFeatureValueType.BOOLEAN,
                          ],
                        },
                        "$itemFeatures.value",
                        null,
                      ],
                    },
                  },
                },
              },
              { $sort: { key: 1, _id: 1 } },
            ],
          },
        },
        {
          $project: {
            nonEmptyGroupIds: "$nonEmptyGroups._id",
            tags: 1,
            features: 1,
          },
        },
      ],
    )

    return result ?? { nonEmptyGroupIds: [], tags: [], features: [] }
  }

  findByCollectionAndItems(
    props: ICollectionItemsSelectionProps,
    options?: Pick<MongooseBulkWriteOptions, "session">,
  ) {
    return this.read.findMany(
      { collectionId: props.collectionId, item: { $in: props.itemIds } },
      { _id: 1, item: 1 },
      options,
    )
  }

  upsertForCollection(
    props: ICreateCollectionItemsProps,
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
    props: IRemoveCollectionItemsProps,
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
    props: ICreateCollectionItemsProps,
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

export { CollectionItemRepository }
