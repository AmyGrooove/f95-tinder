import type { Types } from "mongoose"

import type { IRecommendationFilter } from "../../../types/IRecommendationFilter"

interface ICreateItemFilterPipelineProps {
  filter?: IRecommendationFilter
  candidateItemIds?: readonly Types.ObjectId[]
  excludeItemIds?: readonly Types.ObjectId[]
}

export type { ICreateItemFilterPipelineProps }
