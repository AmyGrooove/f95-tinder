import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import type { ItemTag, TCreateItemTag } from "../schemas/itemTag.schema"
import type { ItemTagMutationService } from "./itemTagMutation.service"

class ItemTagWriteRepository extends MongoWriteRepository<
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

  override async create(
    ...[payload, options]: Parameters<
      MongoWriteRepository<
        ItemTag,
        HydratedDocument<ItemTag>,
        TCreateItemTag
      >["create"]
    >
  ) {
    return await this.mutations.run({
      mutate: () => super.create(payload, options),
      itemIds: [payload.item],
      session: options?.session,
    })
  }

  override async updateById(
    ...[id, payload, options]: Parameters<
      MongoWriteRepository<
        ItemTag,
        HydratedDocument<ItemTag>,
        TCreateItemTag
      >["updateById"]
    >
  ) {
    return await this.mutations.run({
      mutate: () => super.updateById(id, payload, options),
      filters: [{ _id: new Types.ObjectId(id) }],
      session: options?.session,
    })
  }

  override async updateByFilter(
    ...[filter, payload, options]: Parameters<
      MongoWriteRepository<
        ItemTag,
        HydratedDocument<ItemTag>,
        TCreateItemTag
      >["updateByFilter"]
    >
  ) {
    return await this.mutations.run({
      mutate: () => super.updateByFilter(filter, payload, options),
      filters: [filter],
      session: options?.session,
    })
  }

  override async deleteById(
    ...[id, options]: Parameters<
      MongoWriteRepository<
        ItemTag,
        HydratedDocument<ItemTag>,
        TCreateItemTag
      >["deleteById"]
    >
  ) {
    return await this.mutations.run({
      mutate: () => super.deleteById(id, options),
      filters: [{ _id: new Types.ObjectId(id) }],
      session: options?.session,
    })
  }

  override async deleteByFilter(
    ...[filter, options]: Parameters<
      MongoWriteRepository<
        ItemTag,
        HydratedDocument<ItemTag>,
        TCreateItemTag
      >["deleteByFilter"]
    >
  ) {
    return await this.mutations.run({
      mutate: () => super.deleteByFilter(filter, options),
      filters: [filter],
      session: options?.session,
    })
  }
}

export { ItemTagWriteRepository }
