import type {
  HydratedDocument,
  InsertManyOptions,
  Model,
  mongo,
  QueryFilter,
} from "mongoose"

import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import type { TagItem, TCreateTagItem } from "../schemas/tagItem.schema"
import type { TagItemMutationService } from "./tagItemMutation.service"

class TagItemBulkRepository extends MongoBulkRepository<
  TagItem,
  HydratedDocument<TagItem>,
  TCreateTagItem
> {
  constructor(
    model: Model<HydratedDocument<TagItem>>,
    private readonly mutations: TagItemMutationService,
  ) {
    super(model)
  }

  override async createMany(
    payloads: TCreateTagItem[],
  ): Promise<HydratedDocument<TagItem>[]>
  override async createMany(
    payloads: TCreateTagItem[],
    options: InsertManyOptions & Record<"rawResult", true>,
  ): Promise<mongo.InsertManyResult<HydratedDocument<TagItem>>>
  override async createMany(
    payloads: TCreateTagItem[],
    options: InsertManyOptions & Record<"lean", true>,
  ): Promise<TagItem[]>
  override async createMany(
    payloads: TCreateTagItem[],
    options: InsertManyOptions,
  ): Promise<
    | HydratedDocument<TagItem>[]
    | TagItem[]
    | mongo.InsertManyResult<HydratedDocument<TagItem>>
  >
  override async createMany(
    payloads: TCreateTagItem[],
    options?: InsertManyOptions,
  ): Promise<
    | HydratedDocument<TagItem>[]
    | TagItem[]
    | mongo.InsertManyResult<HydratedDocument<TagItem>>
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
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
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
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
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
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
      >["bulkWrite"]
    >
  ) {
    const filters: QueryFilter<TagItem>[] = []
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

export { TagItemBulkRepository }
