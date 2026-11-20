import { beforeAll, describe, expect, it } from "@jest/globals"
import { Types } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { Tag, TagSchema } from "@entities/tag/schemas/tag.schema"
import { TagItemBulkRepository } from "@entities/tagItem/services/tagItemBulkRepository"
import type { TagItemMutationService } from "@entities/tagItem/services/tagItemMutationService"
import { TagItemWriteRepository } from "@entities/tagItem/services/tagItemWriteRepository"
import { getTestDatabase } from "@infrastructure/database/__tests__/setup/setupDatabase"

import { TagItem, TagItemSchema } from "../../../schemas/tagItem.schema"
import { TagItemRepository } from "../core/tagItem.repository"

describe("TagItemRepository", () => {
  let repository: TagItemRepository
  let links: ConstructorParameters<typeof TagItemRepository>[0]

  beforeAll(() => {
    const { connection } = getTestDatabase()
    connection.model(Tag.name, TagSchema)
    links = connection.model(TagItem.name, TagItemSchema) as unknown as Model<
      HydratedDocument<TagItem>
    >
    repository = new TagItemRepository(links, {} as TagItemMutationService)
  })

  it("предоставляет операции записи с обработкой изменения связей тегов", () => {
    expect(repository.write).toBeInstanceOf(TagItemWriteRepository)
    expect(repository.bulk).toBeInstanceOf(TagItemBulkRepository)
  })

  it("проверяет ключи тегов только для запрошенного тайтла и группы", async () => {
    const itemId = new Types.ObjectId()
    const unrelated = new Types.ObjectId()
    const tag = new Types.ObjectId()
    const tags = getTestDatabase().connection.model(Tag.name)
    await tags.collection.insertOne({
      _id: tag,
      group: ETagGroup.GENRE,
      key: "comedy",
    })
    await links.create({ item: itemId, tag, relevanceScore: 1 })

    const query = { itemId, group: ETagGroup.GENRE, keys: ["drama", "comedy"] }
    await expect(repository.checkHasTagKeys(query)).resolves.toBe(true)
    await expect(
      repository.checkHasTagKeys({ ...query, keys: ["drama"] }),
    ).resolves.toBe(false)
    await expect(
      repository.checkHasTagKeys({ ...query, group: ETagGroup.KEYWORD }),
    ).resolves.toBe(false)
    await expect(
      repository.checkHasTagKeys({ ...query, itemId: unrelated }),
    ).resolves.toBe(false)
    await tags.deleteOne({ _id: tag }).exec()
    await expect(repository.checkHasTagKeys(query)).resolves.toBe(false)
  })
})
