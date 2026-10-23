import { expect } from "@jest/globals"
import { Types } from "mongoose"

import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemRepository } from "@entities/item/services/item.repository"
import { createAccount } from "@endpoints/account/__tests__/functions/createAccount"
import { getTestApplication } from "@test/setup/setupIntegration"

import type { CreateCollectionBodyDto } from "../../dto/body/createCollection.body"
import type { CollectionResponseDto } from "../../dto/response/collection.response"

const createCollection = async (
  overrides: Partial<CreateCollectionBodyDto> = {},
) => {
  const { app } = getTestApplication()
  const owner = await createAccount()
  const repository = app.get(ItemRepository)
  const first = await repository.write.create({
    type: EItemType.MOVIE,
    title: { ru: "Альфа", en: "Alpha" },
  })
  const second = await repository.write.create({
    type: EItemType.MOVIE,
    title: { ru: "Бета", en: "Beta" },
  })
  const firstGroupId = new Types.ObjectId().toHexString()
  const secondGroupId = new Types.ObjectId().toHexString()
  const textId = new Types.ObjectId().toHexString()
  const body = {
    title: { ru: "Подборка", en: null },
    blocks: [
      { id: firstGroupId, type: ECollectionBlockType.GROUP },
      {
        id: textId,
        type: ECollectionBlockType.TEXT,
        content: { ru: "Текст", en: null },
      },
      {
        id: secondGroupId,
        type: ECollectionBlockType.GROUP,
        title: { ru: "Группа", en: null },
      },
    ],
    items: [
      {
        itemId: first._id.toHexString(),
        groupId: firstGroupId,
        position: 1,
        note: "  Заметка  ",
      },
      { itemId: second._id.toHexString(), groupId: secondGroupId, position: 0 },
    ],
    ...overrides,
  } satisfies CreateCollectionBodyDto
  const response = await app.inject({
    method: "POST",
    url: "/collections",
    headers: owner.headers,
    payload: body,
  })
  expect(response.statusCode).toBe(201)

  return {
    owner,
    first,
    second,
    firstGroupId,
    secondGroupId,
    textId,
    body,
    collection: response.json<CollectionResponseDto>(),
  }
}

export { createCollection }
