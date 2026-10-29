import { Injectable, OnModuleInit } from "@nestjs/common"
import { mongo, Types } from "mongoose"
import type { HydratedDocument } from "mongoose"

import { TagRepository } from "@entities/tag/services/tag.repository"
import type { Tag } from "@entities/tag/schemas/tag.schema"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { CollectionRepository } from "@entities/collection/services/collection.repository"
import { isNil } from "@shared/functions/checks/isNil"

import tagDictionary from "../../../../import/tags/tags.json" with { type: "json" }

@Injectable()
class TagCollectionsInitializationService implements OnModuleInit {
  constructor(
    private readonly tags: TagRepository,
    private readonly collections: CollectionRepository,
  ) {}

  async onModuleInit() {
    await this.tags.initialize()
    await this.collections.initialize()

    const definitions = new Map(
      tagDictionary.flatMap(({ group, tags }) =>
        tags.map((tag) => [tag.key, { ...tag, group }] as const),
      ),
    )
    const resolved = new Map<string, HydratedDocument<Tag>>()
    const resolving = new Set<string>()

    const ensureTag = async (key: string): Promise<HydratedDocument<Tag>> => {
      const cached = resolved.get(key)

      if (!isNil(cached)) {
        return cached
      }

      const existing = await this.tags.read.findOne({ key })

      if (!isNil(existing)) {
        resolved.set(key, existing)
        return existing
      }

      const definition = definitions.get(key)

      if (isNil(definition) || resolving.has(key)) {
        throw new Error(`Invalid tag dictionary parent: ${key}`)
      }

      const group = Object.values(ETagGroup).find(
        (group) => group === definition.group,
      )

      if (isNil(group)) {
        throw new Error(`Invalid tag dictionary group: ${definition.group}`)
      }

      resolving.add(key)
      const parents: Types.ObjectId[] = []

      for (const parent of definition.parents) {
        parents.push((await ensureTag(parent))._id)
      }

      try {
        const created = await this.tags.write.create({
          key,
          group,
          name: definition.name,
          description: definition.description,
          aliases: definition.aliases,
          parents,
        })

        resolved.set(key, created)
        return created
      } catch (error) {
        if (
          error instanceof mongo.MongoServerError &&
          error.code === 11000 &&
          error.keyPattern?.key === 1
        ) {
          const concurrent = await this.tags.read.findOne({ key })

          if (!isNil(concurrent)) {
            resolved.set(key, concurrent)
            return concurrent
          }
        }

        throw error
      } finally {
        resolving.delete(key)
      }
    }

    for (const key of definitions.keys()) {
      await ensureTag(key)
    }

    for (const tag of await this.tags.read.findMany({})) {
      await this.collections.ensureForTag(tag._id, tag.name)
    }
  }
}

export { TagCollectionsInitializationService }
