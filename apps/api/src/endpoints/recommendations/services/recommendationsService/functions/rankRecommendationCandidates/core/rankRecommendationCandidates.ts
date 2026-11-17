interface IRankRecommendationCandidatesProps {
  itemIds: readonly string[]
  popularity: Float32Array
  scores: Float32Array
  candidateIndices: readonly number[]
}

const rankRecommendationCandidates = ({
  itemIds,
  popularity,
  scores,
  candidateIndices,
}: IRankRecommendationCandidatesProps) => {
  return candidateIndices
    .toSorted((left, right) => {
      if (scores[left] !== scores[right]) {
        return scores[right] - scores[left]
      }

      if (popularity[left] !== popularity[right]) {
        return popularity[right] - popularity[left]
      }

      return left - right
    })
    .map((index) => ({ itemId: itemIds[index], score: scores[index] }))
}

export { rankRecommendationCandidates }
