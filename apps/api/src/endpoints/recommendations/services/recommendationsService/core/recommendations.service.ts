import { Injectable } from "@nestjs/common"

import { RecommendationCandidatesService } from "@endpoints/recommendations/services/recommendationCandidatesService"
import type { IReadRecommendationCandidatesProps } from "@endpoints/recommendations/services/recommendationCandidatesService"

@Injectable()
class RecommendationsService {
  constructor(
    private readonly candidatesService: RecommendationCandidatesService,
  ) {}

  async readPopularItemIds(
    accessToken: unknown,
    props: IReadRecommendationCandidatesProps,
  ) {
    const context = await this.candidatesService.prepareContext(accessToken)

    return this.candidatesService.readPopularItemIds(context, props)
  }

  async readNewItemIds(
    accessToken: unknown,
    props: IReadRecommendationCandidatesProps,
  ) {
    const context = await this.candidatesService.prepareContext(accessToken)

    return this.candidatesService.readNewItemIds(context, props)
  }
}

export { RecommendationsService }
