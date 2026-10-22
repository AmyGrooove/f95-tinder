import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type {
  HydratedDocument,
  InsertManyOptions,
  Model,
  MongooseBulkWriteOptions,
} from "mongoose"

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

  findByCollectionAndItems(
    props: ICollectionItemsSelectionProps,
    options?: Pick<MongooseBulkWriteOptions, "session">,
  ) {
    return this.read.findMany(
      { collection: props.collectionId, item: { $in: props.itemIds } },
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
          filter: { collection: props.collectionId, item: item.item },
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
            $setOnInsert: { collection: props.collectionId, item: item.item },
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
        collection: props.collectionId,
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
      props.items.map((item) => ({ ...item, collection: props.collectionId })),
      options ?? {},
    )
  }
}

export { CollectionItemRepository }
