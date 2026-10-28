import type {
  HydratedDocument,
  InsertManyOptions,
  Model,
  mongo,
  QueryFilter,
} from "mongoose"

import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import type { ItemTag, TCreateItemTag } from "../schemas/itemTag.schema"
import type { ItemTagMutationService } from "./itemTagMutation.service"

class ItemTagBulkRepository extends MongoBulkRepository<
  ItemTag,
  HydratedDocument<ItemTag>,
  TCreateItemTag
> {
  constructor(
    model: Model<HydratedDocument<ItemTag>>,
    private readonly mutations: ItemTagMutationService,
  ) {
    super(model)
  }

  override async createMany(
    payloads: TCreateItemTag[],
  ): Promise<HydratedDocument<ItemTag>[]>
  override async createMany(
    payloads: TCreateItemTag[],
    options: InsertManyOptions & Record<"rawResult", true>,
  ): Promise<mongo.InsertManyResult<HydratedDocument<ItemTag>>>
  override async createMany(
    payloads: TCreateItemTag[],
    options: InsertManyOptions & Record<"lean", true>,
  ): Promise<ItemTag[]>
  override async createMany(
    payloads: TCreateItemTag[],
    options: InsertManyOptions,
  ): Promise<
    | HydratedDocument<ItemTag>[]
    | ItemTag[]
    | mongo.InsertManyResult<HydratedDocument<ItemTag>>
  >
  override async createMany(
    payloads: TCreateItemTag[],
    options?: InsertManyOptions,
  ): Promise<
    | HydratedDocument<ItemTag>[]
    | ItemTag[]
    | mongo.InsertManyResult<HydratedDocument<ItemTag>>
  > {
    return await this.mutations.run({
      mutate: () => super.createMany(payloads, options ?? {}),
      itemIds: payloads.map((payload) => payload.item),
      session: options?.session,
      isPartialWritePossible: true,
    })
  }

  override async updateMany(
    ...[filter, payload, options]: Parameters<
      MongoBulkRepository<
        ItemTag,
        HydratedDocument<ItemTag>,
        TCreateItemTag
      >["updateMany"]
    >
  ) {
    return await this.mutations.run({
      mutate: () => super.updateMany(filter, payload, options),
      filters: [filter],
      session: options?.session,
      isPartialWritePossible: true,
    })
  }

  override async deleteMany(
    ...[filter, options]: Parameters<
      MongoBulkRepository<
        ItemTag,
        HydratedDocument<ItemTag>,
        TCreateItemTag
      >["deleteMany"]
    >
  ) {
    return await this.mutations.run({
      mutate: () => super.deleteMany(filter, options),
      filters: [filter],
      session: options?.session,
      isPartialWritePossible: true,
    })
  }

  override async bulkWrite(
    ...[operations, options]: Parameters<
      MongoBulkRepository<
        ItemTag,
        HydratedDocument<ItemTag>,
        TCreateItemTag
      >["bulkWrite"]
    >
  ) {
    const filters: QueryFilter<ItemTag>[] = []
    const itemIds = operations.flatMap((operation) => {
      if ("insertOne" in operation) {
        return [operation.insertOne.document.item]
      }

      const mutation =
        "updateOne" in operation
          ? operation.updateOne
          : "updateMany" in operation
            ? operation.updateMany
            : "deleteOne" in operation
              ? operation.deleteOne
              : "deleteMany" in operation
                ? operation.deleteMany
                : operation.replaceOne

      filters.push(mutation.filter)
      return []
    })

    return await this.mutations.run({
      mutate: () => super.bulkWrite(operations, options),
      filters,
      itemIds,
      session: options?.session,
      isPartialWritePossible: true,
    })
  }
}

export { ItemTagBulkRepository }
