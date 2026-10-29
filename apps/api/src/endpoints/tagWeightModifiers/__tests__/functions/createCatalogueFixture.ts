import { Types, type Connection } from "mongoose"

import { EItemType } from "@entities/item/schemas/EItemType"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"

const createCatalogueFixture = async (connection: Connection) => {
  const createTag = (key: string, group: ETagGroup | null) => {
    return {
      _id: new Types.ObjectId(),
      key,
      group,
      name: { ru: key, en: null },
      description: { ru: "Описание", en: null },
      aliases: ["Синоним"],
      embedding: null,
      weightModifier: 1.75,
      createdAt: new Date("2026-10-20T00:00:00.000Z"),
      updatedAt: new Date("2026-10-20T00:00:00.000Z"),
    }
  }
  const common = createTag("commonGenre", ETagGroup.GENRE)
  const rare = createTag("rareGenre", ETagGroup.GENRE)
  const unused = createTag("unusedGenre", ETagGroup.GENRE)
  const mechanic = createTag("commonMechanic", ETagGroup.GAME_MECHANIC)
  const rareMechanic = createTag("rareMechanic", ETagGroup.GAME_MECHANIC)
  const empty = createTag("unusedStyle", ETagGroup.STYLE)
  const audience = createTag("audience", ETagGroup.AUDIENCE)
  const ungrouped = createTag("ungrouped", null)
  const duration = createTag("duration0To30", ETagGroup.DURATION)
  const tags = [
    common,
    rare,
    unused,
    mechanic,
    rareMechanic,
    empty,
    audience,
    ungrouped,
    duration,
  ]
  await connection.collection("Tag").insertMany(tags)

  const items = [
    EItemType.GAME,
    EItemType.GAME,
    EItemType.GAME,
    EItemType.GAME,
    EItemType.MOVIE,
    EItemType.MOVIE,
    EItemType.GAME,
    EItemType.GAME,
  ].map((type, index) => {
    return {
      _id: new Types.ObjectId(),
      type,
      deletedAt: index === 6 ? new Date() : null,
      title: { ru: `Произведение ${index}`, en: null },
    }
  })
  await connection.collection("Item").insertMany(items)
  const supports = items.flatMap((item, index) => {
    const tagItems = index < 6 ? [common] : [audience, ungrouped]

    if (index === 0 || index === 6) {
      tagItems.push(rare)
    }

    if (index < 2 || index === 4 || index === 6) {
      tagItems.push(mechanic)
    }

    if (index === 0 || index === 4) {
      tagItems.push(rareMechanic)
    }

    if (index === 0) {
      tagItems.push(duration)
    }

    return tagItems.map((tag) => {
      return {
        item: item._id,
        tag: tag._id,
        relevanceScore: tag === rare ? 0 : 1,
      }
    })
  })
  supports.push({
    item: new Types.ObjectId(),
    tag: rare._id,
    relevanceScore: 1,
  })
  await connection.collection("TagItem").insertMany(supports)

  return {
    tags,
    common,
    rare,
    unused,
    mechanic,
    rareMechanic,
    empty,
    audience,
    ungrouped,
    duration,
  }
}

export { createCatalogueFixture }
