import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import type { TagItem, TCreateTagItem } from "../schemas/tagItem.schema"
import type { TagItemMutationService } from "./tagItemMutation.service"

class TagItemWriteRepository extends MongoWriteRepository<
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

  override async create(
    ...[payload, options]: Parameters<
      MongoWriteRepository<
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
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
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
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
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
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
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
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
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
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

export { TagItemWriteRepository }
