import type { IItemPosterCard } from "@entities/item/services/itemRepository"
import type { ICursorPaginationResult } from "@infrastructure/database/types/IPaginationResult"

type TFindRecommendationsResult = ICursorPaginationResult<IItemPosterCard>

export type { TFindRecommendationsResult }
