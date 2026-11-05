import type { IItemCollectionCard } from "./IItemCollectionCard"

interface IItemCollectionsAggregationResult {
  items: IItemCollectionCard[]
  count: { total: number }[]
}

export type { IItemCollectionsAggregationResult }
