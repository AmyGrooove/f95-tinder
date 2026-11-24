import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import type { TagItemMutationService } from "@entities/tagItem/services/tagItemMutationService"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWriteRepository"

import type { TagItem, TCreateTagItem } from "../../../schemas/tagItem.schema"

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
    ...args: Parameters<
      MongoWriteRepository<
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
      >["create"]
    >
  ) {
    const [payload, options] = args

    return await this.mutations.run({
      mutate: () => super.create(payload, options),
      itemIds: [payload.item],
      session: options?.session,
    })
  }

  override async updateById(
    ...args: Parameters<
      MongoWriteRepository<
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
      >["updateById"]
    >
  ) {
    const [id, payload, options] = args

    return await this.mutations.run({
      mutate: () => super.updateById(id, payload, options),
      filters: [{ _id: new Types.ObjectId(id) }],
      session: options?.session,
    })
  }

  override async updateByFilter(
    ...args: Parameters<
      MongoWriteRepository<
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
      >["updateByFilter"]
    >
  ) {
    const [filter, payload, options] = args

    return await this.mutations.run({
      mutate: () => super.updateByFilter(filter, payload, options),
      filters: [filter],
      session: options?.session,
    })
  }

  override async deleteById(
    ...args: Parameters<
      MongoWriteRepository<
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
      >["deleteById"]
    >
  ) {
    const [id, options] = args

    return await this.mutations.run({
      mutate: () => super.deleteById(id, options),
      filters: [{ _id: new Types.ObjectId(id) }],
      session: options?.session,
    })
  }

  override async deleteByFilter(
    ...args: Parameters<
      MongoWriteRepository<
        TagItem,
        HydratedDocument<TagItem>,
        TCreateTagItem
      >["deleteByFilter"]
    >
  ) {
    const [filter, options] = args

    return await this.mutations.run({
      mutate: () => super.deleteByFilter(filter, options),
      filters: [filter],
      session: options?.session,
    })
  }
}

export { TagItemWriteRepository }
