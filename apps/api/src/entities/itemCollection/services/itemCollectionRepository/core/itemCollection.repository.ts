import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type {
  HydratedDocument,
  InsertManyOptions,
  Model,
  MongooseBulkWriteOptions,
} from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import type { ItemStats } from "@entities/itemStats/schemas/itemStats.schema"
import { normalizeEmptyStringToNull } from "@entities/shared/functions/setters/normalizeEmptyStringToNull"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
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

  readContentSlice(
    props: ICollectionContentSelectionProps & {
      limit: number
      after?: {
        groupOrder: number
        position: number
        id: ItemCollection["_id"]
      }
      types?: readonly EItemType[]
      userId?: UserItem["user"]
      isPersonalFilterApplied: boolean
    },
  ) {
    const {
      after,
      collectionId,
      groupIds,
      types,
      userId,
      isPersonalFilterApplied,
      limit,
    } = props
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

    builder
      .sort({ groupOrder: 1, position: 1, _id: 1 })
      .use(createCollectionCardItemLookup(types), { $unwind: "$item" })

    if (!isUndefined(userId)) {
      builder.use(createCollectionViewerItemLookup(userId), {
        $set: { viewerItem: { $first: "$viewerItem" } },
      })

      if (isPersonalFilterApplied) {
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
    }

    builder.limit(limit).use(createCollectionCardMetricsLookup(), {
      $set: { ratingAverage: { $first: "$metrics.ratingAverage" } },
    })

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

    return this.aggregation.aggregate<
      IItemCollectionCard & {
        _id: ItemCollection["_id"]
        groupOrder: number
        ratingAverage?: ItemStats["ratingAverage"]
        viewerItem?: Pick<UserItem, "status" | "rating">
      }
    >(pipeline)
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
