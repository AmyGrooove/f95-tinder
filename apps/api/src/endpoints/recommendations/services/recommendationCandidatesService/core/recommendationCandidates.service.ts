import { Injectable, UnauthorizedException } from "@nestjs/common"
import { Types } from "mongoose"

import { AuthService } from "@endpoints/auth/services/authService"
import { ItemRepository } from "@entities/item/services/itemRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { SiteRatingsStatsRepository } from "@entities/siteStats/services/siteRatingsStatsRepository"
import { UserRepository } from "@entities/user/services/userRepository"
import { isNil } from "@shared/functions/checks/isNil"
import { requestContext } from "@shared/functions/context/requestContext"

import { NEW_RELEASE_WINDOW_DAYS } from "../static/NEW_RELEASE_WINDOW_DAYS"
import type { IReadRecommendationCandidatesProps } from "../types/IReadRecommendationCandidatesProps"
import type { IRecommendationCandidateContext } from "../types/IRecommendationCandidateContext"

@Injectable()
class RecommendationCandidatesService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly itemRepository: ItemRepository,
    private readonly siteRatingsStatsRepository: SiteRatingsStatsRepository,
  ) {}

  async prepareContext(
    accessToken: unknown,
  ): Promise<IRecommendationCandidateContext> {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const userId = new Types.ObjectId(payload.sub)
    const [session, isUserExists] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.checkIsExists({ _id: userId }),
    ])

    if (isNil(session) || !isUserExists) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)

    const siteRatingAverage =
      await this.siteRatingsStatsRepository.readAverage()

    return { userId, country: session.country, siteRatingAverage }
  }

  readPopularItemIds(
    context: IRecommendationCandidateContext,
    props: IReadRecommendationCandidatesProps<number>,
  ) {
    return this.itemRepository.readPopularItemIds(
      this.prepareCandidateQuery(context, props),
    )
  }

  readNewItemIds(
    context: IRecommendationCandidateContext,
    props: IReadRecommendationCandidatesProps<number>,
  ) {
    const through = new Date()
    const from = new Date(
      through.getTime() - NEW_RELEASE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    )

    return this.itemRepository.readNewItemIds({
      ...this.prepareCandidateQuery(context, props),
      releaseWindow: { from, through },
    })
  }

  private prepareCandidateQuery(
    context: IRecommendationCandidateContext,
    props: IReadRecommendationCandidatesProps<number>,
  ) {
    const { type, limit = 20, filter } = props

    return {
      ...context,
      type,
      limit,
      library: filter?.library,
      tags: filter?.tags,
      rating: filter?.rating,
    }
  }
}

export { RecommendationCandidatesService }
