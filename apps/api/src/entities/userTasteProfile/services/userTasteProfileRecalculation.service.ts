import { Injectable } from "@nestjs/common"
import type { Types } from "mongoose"

import type { EItemType } from "@entities/item/schemas/EItemType"
import { ItemTagRepository } from "@entities/itemTag/services/itemTag.repository"
import { ETagGroup } from "@entities/tag/schemas/ETagGroup"
import { TAG_GROUP_RULES } from "@entities/tag/static/TAG_GROUP_RULES"
import { UserRepository } from "@entities/user/services/user.repository"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { UserItemRepository } from "@entities/userItem/services/userItem.repository"
import { JobService } from "@infrastructure/jobs/services/job.service"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
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
    private readonly itemTagRepository: ItemTagRepository,
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

    const affectedTags = await this.itemTagRepository.read.findMany(
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

    const itemTags =
      userItems.length === 0
        ? []
        : await this.itemTagRepository.getTasteTags({
            itemIds: userItems.map((userItem) => userItem.item),
            groups,
            tagIds,
          })
    const preferencesByTag = new Map<string, ITasteTagAccumulator>()

    for (const itemTag of itemTags) {
      const itemTypes: readonly EItemType[] =
        TAG_GROUP_RULES[itemTag.group].itemTypes
      const contribution = contributionsByItem.get(String(itemTag.item))

      if (isUndefined(contribution) || !itemTypes.includes(itemTag.itemType)) {
        continue
      }

      const tagId = String(itemTag.tag)
      const preference = preferencesByTag.get(tagId) ?? {
        tag: itemTag.tag,
        total: 0,
        count: 0,
      }

      preference.total += contribution * itemTag.relevanceScore
      preference.count += 1
      preferencesByTag.set(tagId, preference)
    }

    return [...preferencesByTag.values()].map((preference) => ({
      tag: preference.tag,
      weight: preference.total / preference.count,
      count: preference.count,
    }))
  }

  private getContribution(
    userItem: Pick<UserItem, "rating" | "isFavorite" | "attempts">,
  ) {
    const { rating, isFavorite, attempts } = userItem

    if (rating !== null && rating <= 4) {
      return (rating - 5) / 4
    }

    const attemptBonus =
      Math.min(3, attempts.filter((attempt) => attempt.isCompleted).length) *
      0.1

    if (rating !== null && rating >= 7) {
      const contribution = (rating - 6) / 4

      return Math.min(
        1,
        (isFavorite ? 0.8 + 0.2 * contribution : contribution) + attemptBonus,
      )
    }

    return Math.min(1, (isFavorite ? 0.8 : 0) + attemptBonus)
  }
}

export { UserTasteProfileRecalculationService }
