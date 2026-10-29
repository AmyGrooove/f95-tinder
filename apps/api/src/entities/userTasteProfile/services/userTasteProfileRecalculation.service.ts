import { Injectable } from "@nestjs/common"
import type { Types } from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import { TagItemRepository } from "@entities/tagItem/services/tagItem.repository"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { TAG_GROUP_RULES } from "@entities/tag/static/TAG_GROUP_RULES"
import { UserRepository } from "@entities/user/services/user.repository"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { JobService } from "@infrastructure/jobs/services/job.service"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"

import { RECALCULATE_USER_TASTE_PROFILE_JOB } from "../static/RECALCULATE_USER_TASTE_PROFILE_JOB"
import type { ITasteTagAccumulator } from "../types/ITasteTagAccumulator"
import type { IRecalculateUserTasteProfileProps } from "../types/IRecalculateUserTasteProfileProps"
import { UserTasteProfileRepository } from "./userTasteProfile.repository"

@Injectable()
class UserTasteProfileRecalculationService {
  constructor(
    private readonly jobService: JobService,
    private readonly userRepository: UserRepository,
    private readonly userItemRepository: UserItemRepository,
    private readonly tagItemRepository: TagItemRepository,
    private readonly userTasteProfileRepository: UserTasteProfileRepository,
  ) {}

  async enqueue(userId: Types.ObjectId, itemId: Types.ObjectId) {
    return await this.jobService.add(
      RECALCULATE_USER_TASTE_PROFILE_JOB,
      { userId: String(userId), itemId: String(itemId) },
      {
        deduplication: {
          id: `${RECALCULATE_USER_TASTE_PROFILE_JOB.name}:${userId}:${itemId}`,
          keepLastIfActive: true,
        },
      },
    )
  }

  async recalculate(
    props: IRecalculateUserTasteProfileProps,
    context: IJobContext,
  ) {
    const { userId, itemId } = props

    await context.throwIfCancelled()

    if (!(await this.userRepository.read.checkIsExists({ _id: userId }))) {
      return { calculatedTags: 0 }
    }

    const affectedTags = await this.tagItemRepository.read.findMany(
      { item: itemId },
      { tag: 1 },
    )
    const tagIds = affectedTags.map((entry) => entry.tag)

    if (tagIds.length === 0) {
      return { calculatedTags: 0 }
    }

    while (true) {
      await context.throwIfCancelled()

      const previousPreferences =
        await this.userTasteProfileRepository.readTagPreferences(userId)
      const preferences = await this.calculatePreferences(userId, tagIds)

      await context.throwIfCancelled()

      const isPublished =
        await this.userTasteProfileRepository.tryReplaceCalculatedPreferences({
          userId,
          tagIds,
          preferences,
          previousPreferences,
        })

      if (isPublished) {
        await context.updateProgress({ progress: 100 })

        return { calculatedTags: preferences.length }
      }
    }
  }

  private async calculatePreferences(
    userId: Types.ObjectId,
    tagIds: readonly Types.ObjectId[],
  ) {
    const userItems = await this.userItemRepository.getTasteInputs(
      userId,
      tagIds,
    )
    const contributionsByItem = new Map(
      userItems.map((userItem) => [
        String(userItem.item),
        this.getContribution(userItem),
      ]),
    )
    const groups = Object.values(ETagGroup).filter(
      (group) => TAG_GROUP_RULES[group].isUsedForTaste,
    )

    const tagItems =
      userItems.length === 0
        ? []
        : await this.tagItemRepository.getTasteTags({
            itemIds: userItems.map((userItem) => userItem.item),
            groups,
            tagIds,
          })
    const preferencesByTag = new Map<string, ITasteTagAccumulator>()

    for (const tagItem of tagItems) {
      const itemTypes: readonly EItemType[] =
        TAG_GROUP_RULES[tagItem.group].itemTypes
      const contribution = contributionsByItem.get(String(tagItem.item))

      if (isUndefined(contribution) || !itemTypes.includes(tagItem.itemType)) {
        continue
      }

      const tagId = String(tagItem.tag)
      const preference = preferencesByTag.get(tagId) ?? {
        tag: tagItem.tag,
        total: 0,
        count: 0,
      }

      preference.total += contribution * tagItem.relevanceScore
      preference.count += 1
      preferencesByTag.set(tagId, preference)
    }

    return [...preferencesByTag.values()].map((preference) => ({
      tag: preference.tag,
      weight: preference.total / preference.count,
      count: preference.count,
    }))
  }

  private getContribution(userItem: Pick<UserItem, "rating" | "isFavorite">) {
    const { rating, isFavorite } = userItem

    if (!isNil(rating) && rating <= 4) {
      return (rating - 5) / 4
    }

    if (!isNil(rating) && rating >= 7) {
      const contribution = (rating - 6) / 4

      return isFavorite ? Math.max(0.5, contribution) : contribution
    }

    return isFavorite ? 0.5 : 0
  }
}

export { UserTasteProfileRecalculationService }
