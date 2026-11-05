import type { Types } from "mongoose"

import type { IItemFilter } from "../../../types/IItemFilter"

interface ICreateItemFilterPipelineProps {
  filter?: IItemFilter
  candidateItemIds?: readonly Types.ObjectId[]
  excludeItemIds?: readonly Types.ObjectId[]
}

export type { ICreateItemFilterPipelineProps }
