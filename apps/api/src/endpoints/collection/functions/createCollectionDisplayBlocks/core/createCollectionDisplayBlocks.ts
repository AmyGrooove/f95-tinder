import { ELanguage } from "@entities/shared/schemas/ELanguage"
import { ECollectionBlockType } from "@entities/collection/schemas/ECollectionBlockType"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import type { CollectionItemsResponseDto } from "../../../dto/response/collectionItems.response"
import type { ICreateCollectionDisplayBlocksProps } from "../types/ICreateCollectionDisplayBlocksProps"

const createCollectionDisplayBlocks = ({
  blocks,
  groupCounts,
  page,
  isFiltered,
}: ICreateCollectionDisplayBlocksProps): CollectionItemsResponseDto["displayBlocks"] => {
  const counts = new Map(
    groupCounts.map((group) => [group.groupId.toHexString(), group.total]),
  )
  const start = (page.page - 1) * page.limit
  const end = start + page.items.length
  const displayBlocks: CollectionItemsResponseDto["displayBlocks"] = []
  let offset = 0

  for (const block of blocks) {
    const id = block.id.toHexString()

    if (block.type === ECollectionBlockType.GROUP) {
      const firstItem = page.items.find(
        (item) => item.membership.groupId === id,
      )

      if (!isUndefined(firstItem)) {
        displayBlocks.push({
          id,
          type: ECollectionBlockType.GROUP,
          title: isNil(block.title)
            ? null
            : {
                [ELanguage.RUSSIAN]: block.title[ELanguage.RUSSIAN],
                [ELanguage.ENGLISH]: block.title[ELanguage.ENGLISH],
              },
          description: isNil(block.description)
            ? null
            : {
                [ELanguage.RUSSIAN]: block.description[ELanguage.RUSSIAN],
                [ELanguage.ENGLISH]: block.description[ELanguage.ENGLISH],
              },
          beforeItemId: firstItem.id,
        })
      }

      offset += counts.get(id) ?? 0

      continue
    }

    if (isFiltered) {
      continue
    }

    const isBeforeItemOnPage = offset >= start && offset < end
    const isTrailingText =
      offset === page.total && page.items.length > 0 && end === page.total
    const isEmptyFirstPage = page.total === 0 && page.page === 1

    if (isBeforeItemOnPage || isTrailingText || isEmptyFirstPage) {
      displayBlocks.push({
        id,
        type: ECollectionBlockType.TEXT,
        content: {
          [ELanguage.RUSSIAN]: block.content?.[ELanguage.RUSSIAN] ?? null,
          [ELanguage.ENGLISH]: block.content?.[ELanguage.ENGLISH] ?? null,
        },
        beforeItemId: page.items[offset - start]?.id ?? null,
      })
    }
  }

  return displayBlocks
}

export { createCollectionDisplayBlocks }
