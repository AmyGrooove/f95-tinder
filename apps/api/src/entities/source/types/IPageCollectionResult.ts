interface IPageCollectionResult {
  processedPages: number
  reason: "completed" | "stopped"
}

export type { IPageCollectionResult }
