import { Injectable } from "@nestjs/common"

import { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { TagRepository } from "@entities/tag/services/tag.repository"
import { TAG_GROUP_RULES } from "@entities/tag/static/TAG_GROUP_RULES"
import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import type { IJobHandler } from "@infrastructure/jobs/types/IJobHandler"

import { RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB } from "../static/RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB"

@Injectable()
@JobHandler(RECALCULATE_TAG_WEIGHT_MODIFIERS_JOB)
class RecalculateTagWeightModifiersJobHandler implements IJobHandler<null> {
  constructor(
    private readonly tagRepository: TagRepository,
    private readonly itemTagRepository: ItemTagRepository,
  ) {}

  async handle(_payload: null, context: IJobContext) {
    const groups = Object.values(ETagGroup).filter(
      (group) => TAG_GROUP_RULES[group].isUsedForTaste,
    )
    let processedGroups = 0
    let updatedTags = 0

    for (const group of groups) {
      await context.throwIfCancelled()

      const tags = await this.tagRepository.read.findMany({ group }, { _id: 1 })

      if (tags.length > 0) {
        const { itemCount, tagCounts } =
          await this.itemTagRepository.getUsageCounts(
            tags.map((tag) => tag._id),
            TAG_GROUP_RULES[group].itemTypes,
          )
        const countsByTag = new Map(
          tagCounts.map((entry) => [String(entry._id), entry.count]),
        )
        const operations = tags.map((tag) => {
          const count = countsByTag.get(String(tag._id)) ?? 0
          const weightModifier =
            itemCount === 0 || count === 0
              ? 1
              : Math.min(
                  2,
                  Math.max(0.25, Math.log((itemCount + 1) / (count + 1))),
                )

          return {
            updateOne: {
              filter: { _id: tag._id, group },
              update: { $set: { weightModifier } },
            },
          }
        })

        await context.throwIfCancelled()

        const result = await this.tagRepository.bulk.bulkWrite(operations, {
          ordered: false,
        })

        updatedTags += result.modifiedCount
      }

      processedGroups += 1

      await context.updateProgress({
        progress: Math.round((processedGroups / groups.length) * 100),
      })
    }

    return { processedGroups, updatedTags }
  }
}

export { RecalculateTagWeightModifiersJobHandler }
