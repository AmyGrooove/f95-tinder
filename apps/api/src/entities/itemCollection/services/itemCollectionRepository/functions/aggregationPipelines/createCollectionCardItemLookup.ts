import type { PipelineStage } from "mongoose"
import { Item } from "@entities/item/schemas/item.schema"
import type { EItemType } from "@entities/item/schemas/EItemType"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { escapeRegex } from "@shared/functions/regex/escapeRegex"
import { AggregationBuilder } from "@infrastructure/database/services/aggregationBuilder"

const createCollectionCardItemLookup = (
  types?: readonly EItemType[],
  search?: string,
): PipelineStage.Lookup => {
  const text = isUndefined(search)
    ? undefined
    : { $regex: escapeRegex(search), $options: "i" }

  return {
    $lookup: {
      from: Item.name,
      localField: "item",
      foreignField: "_id",
      as: "item",
      pipeline: AggregationBuilder.forLookup()
        .match({
          deletedAt: null,
          ...(!isUndefined(types) && { type: { $in: types } }),
          ...(!isUndefined(text) && {
            $or: [
              { "title.ru": text },
              { "title.en": text },
              { aliases: text },
            ],
          }),
        })
        .project({ _id: 1, type: 1, title: 1, media: 1, releaseDate: 1 })
        .build(),
    },
  }
}

export { createCollectionCardItemLookup }
