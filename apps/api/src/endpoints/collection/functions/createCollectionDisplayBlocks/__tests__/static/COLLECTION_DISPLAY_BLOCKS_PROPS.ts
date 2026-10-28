import { Types } from "mongoose"

import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { EItemType } from "@entities/item/schemas/EItemType"

import type { ICreateCollectionDisplayBlocksProps } from "../../types/ICreateCollectionDisplayBlocksProps"

const COLLECTION_DISPLAY_BLOCKS_PROPS: ICreateCollectionDisplayBlocksProps = {
  blocks: [
    ECollectionBlockType.TEXT,
    ECollectionBlockType.GROUP,
    ECollectionBlockType.TEXT,
    ECollectionBlockType.GROUP,
    ECollectionBlockType.TEXT,
    ECollectionBlockType.GROUP,
    ECollectionBlockType.TEXT,
  ].map((type, index) => ({
    id: new Types.ObjectId((index + 1).toString().padStart(24, "0")),
    type,
    title:
      type === ECollectionBlockType.GROUP
        ? { ru: "Группа", en: "Group" }
        : null,
    description:
      type === ECollectionBlockType.GROUP ? { ru: "Описание", en: null } : null,
    content:
      type === ECollectionBlockType.TEXT ? { ru: "Текст", en: "Text" } : null,
  })),
  groupCounts: [
    { groupId: new Types.ObjectId("000000000000000000000002"), total: 3 },
    { groupId: new Types.ObjectId("000000000000000000000006"), total: 2 },
  ],
  page: {
    items: [2, 2, 2, 6, 6].map((group, index) => ({
      id: `item-${index + 1}`,
      type: EItemType.MOVIE,
      title: { ru: "Фильм", en: null },
      media: [],
      membership: {
        groupId: group.toString().padStart(24, "0"),
        position: index,
        note: null,
      },
    })),
    page: 1,
    limit: 5,
    total: 5,
    pages: 1,
    isNextPage: false,
    isPreviousPage: false,
  },
  isFiltered: false,
}

export { COLLECTION_DISPLAY_BLOCKS_PROPS }
