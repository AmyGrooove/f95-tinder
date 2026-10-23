import type { ICollectionItemCard } from "./ICollectionItemCard"

interface ICollectionItemsPage {
  items: ICollectionItemCard[]
  count: { total: number }[]
}

export type { ICollectionItemsPage }
