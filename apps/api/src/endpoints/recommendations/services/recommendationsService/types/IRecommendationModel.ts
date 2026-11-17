interface IRecommendationModel {
  id: string
  trainedAt: Date
  itemIds: readonly string[]
  itemCF: {
    offsets: Int32Array
    indices: Int32Array
    weights: Float32Array
  }
  als: {
    factors: number
    alpha: number
    regularization: number
    itemFactors: Float32Array
    gram: Float64Array
  }
  popularity: Float32Array
}

export type { IRecommendationModel }
