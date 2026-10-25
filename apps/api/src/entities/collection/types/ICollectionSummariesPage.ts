import type { Collection } from "../schemas/collection.schema"

interface ICollectionSummariesPage {
  items: Pick<Collection, "_id" | "type" | "author" | "title" | "media">[]
  total: number
}

export type { ICollectionSummariesPage }
