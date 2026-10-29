import { Injectable } from "@nestjs/common"

import { ItemMetricRepository } from "@entities/itemMetric/services/itemMetric.repository"
import { RATING_DISTRIBUTION_VALUES } from "@entities/itemMetric/static/RATING_DISTRIBUTION_VALUES"
import { SiteRatingsMetricRepository } from "@entities/siteMetric/services/siteRatingsMetric.repository"
import type { UserItem } from "@entities/userItem/schemas/userItem.schema"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { isNil } from "@shared/functions/checks/isNil"

import type { IUserItemMetricState } from "../types/IUserItemMetricState"
import type { IUpdateUserItemMetricsProps } from "../types/IUpdateUserItemMetricsProps"

@Injectable()
class UserItemMetricsService {
  constructor(
    private readonly itemMetricRepository: ItemMetricRepository,
    private readonly siteRatingsMetricRepository: SiteRatingsMetricRepository,
  ) {}

  getState(userItem: UserItem): IUserItemMetricState {
    return {
      rating: userItem.rating,
      isFavorite: userItem.isFavorite,
      status: userItem.status,
      completedAttemptsCount: userItem.attempts.filter(
        (attempt) => attempt.isCompleted,
      ).length,
    }
  }

  async update(props: IUpdateUserItemMetricsProps) {
    const { previous, next, itemId, session } = props
    const ratingsCount =
      Number(!isNil(next?.rating)) - Number(!isNil(previous?.rating))
    const sum = (next?.rating ?? 0) - (previous?.rating ?? 0)
    const favoritesCount =
      Number(next?.isFavorite === true) - Number(previous?.isFavorite === true)
    const completedAttemptsCount =
      (next?.completedAttemptsCount ?? 0) -
      (previous?.completedAttemptsCount ?? 0)
    const ratingDistribution = Object.fromEntries(
      Object.entries(RATING_DISTRIBUTION_VALUES).map(([key, rating]) => [
        key,
        Number(next?.rating === rating) - Number(previous?.rating === rating),
      ]),
    )
    const statusCounts = Object.fromEntries(
      USER_ITEM_LIBRARY_STATUSES.map((status) => [
        status,
        Number(next?.status === status) - Number(previous?.status === status),
      ]),
    )
    const isItemChanged =
      ratingsCount !== 0 ||
      sum !== 0 ||
      favoritesCount !== 0 ||
      completedAttemptsCount !== 0 ||
      Object.values(statusCounts).some((value) => value !== 0)

    if (isItemChanged) {
      await this.itemMetricRepository.applyChanges({
        itemId,
        ratingsCount,
        favoritesCount,
        completedAttemptsCount,
        ratingDistribution,
        statusCounts,
        session,
      })
    }

    if (ratingsCount !== 0 || sum !== 0) {
      await this.siteRatingsMetricRepository.applyChanges({
        sum,
        count: ratingsCount,
        session,
      })
    }
  }
}

export { UserItemMetricsService }
