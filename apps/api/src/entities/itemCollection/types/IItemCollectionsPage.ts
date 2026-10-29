import type { IItemCollectionCard } from "./IItemCollectionCard"

interface IItemCollectionsPage {
  items: IItemCollectionCard[]
  count: { total: number }[]
}

export type { IItemCollectionsPage }
