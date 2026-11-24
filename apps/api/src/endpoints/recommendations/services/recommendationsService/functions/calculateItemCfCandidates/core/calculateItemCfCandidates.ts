import type { IRecommendationModel } from "../../../types/IRecommendationModel"
import { rankRecommendationCandidates } from "../../rankRecommendationCandidates"

const calculateItemCfCandidates = (
  model: Pick<IRecommendationModel, "itemIds" | "itemCF" | "popularity">,
  positiveItemIds: readonly string[],
  options: { isPositiveCandidateAllowed?: boolean } = {},
) => {
  const { isPositiveCandidateAllowed = false } = options

  const { itemIds, itemCF, popularity } = model
  const { offsets, indices, weights } = itemCF
  const positiveIds = new Set(positiveItemIds)
  const scores = new Float32Array(itemIds.length)
  const candidateIndices: number[] = []

  for (const [itemIndex, itemId] of itemIds.entries()) {
    const isPositive = positiveIds.has(itemId)
    if (!isPositive || isPositiveCandidateAllowed) {
      candidateIndices.push(itemIndex)
    }
    if (!isPositive) {
      continue
    }

    const end = offsets[itemIndex + 1]
    for (let position = offsets[itemIndex]; position < end; position += 1) {
      scores[indices[position]] += weights[position]
    }
  }

  return rankRecommendationCandidates({
    itemIds,
    popularity,
    scores,
    candidateIndices,
  })
}

export { calculateItemCfCandidates }
