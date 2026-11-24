import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type {
  HydratedDocument,
  InsertManyOptions,
  Model,
  MongooseBulkWriteOptions,
  PipelineStage,
  Types,
} from "mongoose"

import { Collection } from "@entities/collection/schemas/collection.schema"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { COLLECTION_TYPES } from "@entities/collection/schemas/ECollectionType"
import { Item } from "@entities/item/schemas/item.schema"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { ESort } from "@entities/shared/types/ESort"
import { normalizeEmptyStringToNull } from "@entities/shared/functions/setters/normalizeEmptyStringToNull"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregationRepository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulkRepository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPaginationRepository"
import { MongoReadRepository } from "@infrastructure/database/services/mongoReadRepository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { ItemCollection } from "../../../schemas/itemCollection.schema"
import type { TCreateItemCollection } from "../../../schemas/itemCollection.schema"
import { createCollectionCardItemLookup } from "../functions/aggregationPipelines/createCollectionCardItemLookup"
import { createCollectionCardMetricsLookup } from "../functions/aggregationPipelines/createCollectionCardMetricsLookup"
import { createCollectionViewerItemLookup } from "../functions/aggregationPipelines/createCollectionViewerItemLookup"
import type { ICollectionContentSelectionProps } from "../types/ICollectionContentSelectionProps"
import type { ICreateItemCollectionsProps } from "../types/ICreateItemCollectionsProps"
import type { IItemCollectionCard } from "../types/IItemCollectionCard"
import type { IItemCollectionsSelectionProps } from "../types/IItemCollectionsSelectionProps"
import type { IReadCollectionContentSliceProps } from "../types/IReadCollectionContentSliceProps"
import type { IRemoveItemCollectionsProps } from "../types/IRemoveItemCollectionsProps"

@Injectable()
class ItemCollectionRepository {
  readonly read
  readonly write
  readonly pagination
  readonly bulk
  readonly aggregation

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

  findByCollectionAndItems(
    props: IItemCollectionsSelectionProps,
    options?: Pick<MongooseBulkWriteOptions, "session">,
  ) {
    const { collectionId, itemIds } = props

    return this.read.findMany(
      { collectionId, item: { $in: itemIds } },
      { _id: 1, item: 1 },
      options,
    )
  }

  async readPublicCollectionIdsByItem(item: Types.ObjectId) {
    const memberships = await this.aggregation.aggregate<
      Pick<ItemCollection, "collectionId">
    >(
      new AggregationBuilder()
        .match({ item })
        .project({ _id: 0, collectionId: 1, groupId: 1 })
        .use({
          $lookup: {
            from: Collection.name,
            localField: "collectionId",
            foreignField: "_id",
            let: { groupId: "$groupId" },
            pipeline: [
              {
                $match: {
                  deletedAt: null,
                  type: { $in: COLLECTION_TYPES },
                },
              },
              { $unwind: "$blocks" },
              {
                $match: {
                  "blocks.type": ECollectionBlockType.GROUP,
                  $expr: { $eq: ["$blocks.id", "$$groupId"] },
                },
              },
              { $project: { _id: 1 } },
            ],
            as: "publicCollection",
          },
        })
        .match({ "publicCollection.0": { $exists: true } })
        .project({ _id: 0, collectionId: 1 })
        .build(),
    )

    return memberships.map((membership) => {
      const { collectionId } = membership

      return collectionId.toHexString()
    })
  }

  async readAvailableCounts(
    props: ICollectionContentSelectionProps,
    userId?: UserItem["user"],
  ) {
    const { collectionId, groupIds } = props
    const builder = new AggregationBuilder()
      .match({ collectionId, groupId: { $in: groupIds } })
      .use({
        $lookup: {
          from: Item.name,
          localField: "item",
          foreignField: "_id",
          as: "availableItem",
          pipeline: AggregationBuilder.forLookup()
            .match({ deletedAt: null })
            .project({ _id: 1 })
            .build(),
        },
      })
      .match({ "availableItem.0": { $exists: true } })

    if (!isUndefined(userId)) {
      builder.use({
        $lookup: {
          from: UserItem.name,
          localField: "item",
          foreignField: "item",
          as: "completedItem",
          pipeline: AggregationBuilder.forLookup()
            .match({ user: userId, status: EUserItemStatus.COMPLETED })
            .limit(1)
            .project({ _id: 1 })
            .build(),
        },
      })
    }

    const pipeline = builder
      .use({
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $size: { $ifNull: ["$completedItem", []] } },
          },
        },
      })
      .project({ _id: 0, total: 1, completed: 1 })
      .build()
    const [counts] = await this.aggregation.aggregate<{
      total: number
      completed: number
    }>(pipeline)

    return counts ?? { total: 0, completed: 0 }
  }

  readContentSlice(props: IReadCollectionContentSliceProps) {
    const {
      after,
      collectionId,
      groupIds,
      types,
      userId,
      isPersonalFilterApplied,
      limit,
      isGrouped,
      search,
      rating,
      sort,
    } = props
    const isRatingNeededBeforeLimit =
      !isUndefined(rating) || sort?.field === ESort.RATING
    const builder = new AggregationBuilder()
      .match({ collectionId, groupId: { $in: groupIds } })
      .use({ $set: { groupOrder: { $indexOfArray: [groupIds, "$groupId"] } } })

    if (!isUndefined(after)) {
      builder.match({
        $or: [
          { groupOrder: { $gt: after.groupOrder } },
          {
            groupOrder: after.groupOrder,
            position: { $gt: after.position },
          },
          {
            groupOrder: after.groupOrder,
            position: after.position,
            _id: { $gt: after.id },
          },
        ],
      })
    }

    if (isUndefined(sort)) {
      builder.sort({ groupOrder: 1, position: 1, _id: 1 })
    }

    builder.use(createCollectionCardItemLookup(types, search), {
      $unwind: "$item",
    })

    const ratingStages = [
      createCollectionCardMetricsLookup(),
      { $set: { ratingAverage: { $first: "$metrics.ratingAverage" } } },
    ] satisfies PipelineStage[]
    const viewerStages = isUndefined(userId)
      ? []
      : ([
          createCollectionViewerItemLookup(userId),
          { $set: { viewerItem: { $first: "$viewerItem" } } },
        ] satisfies PipelineStage[])

    if (isPersonalFilterApplied) {
      builder.use(...viewerStages)
      builder.match({
        "viewerItem.status": {
          $nin: [
            EUserItemStatus.COMPLETED,
            EUserItemStatus.DROPPED,
            EUserItemStatus.BLOCKED,
          ],
        },
      })
    }

    if (isRatingNeededBeforeLimit) {
      builder.use(...ratingStages)
    }

    if (!isUndefined(rating)) {
      builder.match({
        ratingAverage: {
          $type: "number",
          ...(!isUndefined(rating.min) && { $gte: rating.min }),
          ...(!isUndefined(rating.max) && { $lte: rating.max }),
        },
      })
    }

    if (!isUndefined(sort)) {
      const { field, direction, language, offset } = sort
      const fallbackLanguage =
        language === ELanguage.RUSSIAN ? ELanguage.ENGLISH : ELanguage.RUSSIAN
      const title = `$item.title.${language}`
      const sortValue =
        field === ESort.TITLE
          ? {
              $cond: [
                { $ne: [{ $trim: { input: { $ifNull: [title, ""] } } }, ""] },
                title,
                `$item.title.${fallbackLanguage}`,
              ],
            }
          : field === ESort.RATING
            ? "$ratingAverage"
            : "$item.releaseDate"

      builder
        .use(
          { $set: { sortValue } },
          {
            $set: {
              hasSortValue: { $ne: [{ $ifNull: ["$sortValue", null] }, null] },
            },
          },
        )
        .sort(
          isGrouped
            ? {
                groupOrder: 1,
                hasSortValue: -1,
                sortValue: direction,
                position: 1,
                _id: 1,
              }
            : {
                hasSortValue: -1,
                sortValue: direction,
                groupOrder: 1,
                position: 1,
                _id: 1,
              },
        )

      if (offset > 0) {
        builder.use({ $skip: offset })
      }
    }

    builder.limit(limit)

    if (!isRatingNeededBeforeLimit) {
      builder.use(...ratingStages)
    }

    if (!isPersonalFilterApplied) {
      builder.use(...viewerStages)
    }

    const pipeline = builder
      .project({
        groupOrder: 1,
        groupId: 1,
        position: 1,
        note: 1,
        item: 1,
        ratingAverage: 1,
        viewerItem: 1,
      })
      .build()

    return this.aggregation.aggregate<IItemCollectionCard>(
      pipeline,
      sort?.field === ESort.TITLE
        ? { collation: { locale: sort.language, strength: 2 } }
        : undefined,
    )
  }

  createForCollection(
    props: ICreateItemCollectionsProps,
    options?: Pick<InsertManyOptions, "session">,
  ) {
    const { items, collectionId } = props

    return this.bulk.createMany(
      items.map((item) => ({
        ...item,
        collectionId,
      })),
      options ?? {},
    )
  }

  upsertForCollection(
    props: ICreateItemCollectionsProps,
    options?: Pick<MongooseBulkWriteOptions, "session">,
  ) {
    const { items, collectionId } = props

    return this.bulk.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { collectionId, item: item.item },
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
              collectionId,
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
    const { collectionId, itemIds, groupIds } = props

    return this.bulk.deleteMany(
      {
        collectionId,
        $or: [{ item: { $in: itemIds } }, { groupId: { $in: groupIds } }],
      },
      options,
    )
  }
}

export { ItemCollectionRepository }
