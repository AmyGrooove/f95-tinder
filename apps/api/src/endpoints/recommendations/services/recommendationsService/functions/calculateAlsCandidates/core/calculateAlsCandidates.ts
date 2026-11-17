import type { IRecommendationModel } from "../../../types/IRecommendationModel"
import { rankRecommendationCandidates } from "../../rankRecommendationCandidates"

const calculateAlsCandidates = (
  model: Pick<IRecommendationModel, "itemIds" | "als" | "popularity">,
  positiveItemIds: readonly string[],
  { isPositiveCandidateAllowed = false } = {},
) => {
  const { itemIds, als, popularity } = model
  const { factors, alpha, regularization, itemFactors, gram } = als
  const positiveIds = new Set(positiveItemIds)
  const candidateIndices: number[] = []
  const matrix = gram.slice()
  const userFactors = new Float64Array(factors)
  let knownPositiveCount = 0

  for (let factor = 0; factor < factors; factor += 1) {
    matrix[factor * factors + factor] += regularization
  }

  for (const [itemIndex, itemId] of itemIds.entries()) {
    const isPositive = positiveIds.has(itemId)
    if (!isPositive || isPositiveCandidateAllowed) {
      candidateIndices.push(itemIndex)
    }
    if (!isPositive) {
      continue
    }

    knownPositiveCount += 1
    const start = itemIndex * factors
    for (let row = 0; row < factors; row += 1) {
      const itemFactor = itemFactors[start + row]
      userFactors[row] += alpha * itemFactor

      for (let column = 0; column <= row; column += 1) {
        matrix[row * factors + column] +=
          (alpha - 1) * itemFactor * itemFactors[start + column]
      }
    }
  }

  const scores = new Float32Array(itemIds.length)
  if (candidateIndices.length > 0 && knownPositiveCount > 0) {
    for (let row = 0; row < factors; row += 1) {
      for (let column = 0; column <= row; column += 1) {
        const index = row * factors + column
        let value = matrix[index]

        for (let factor = 0; factor < column; factor += 1) {
          value -=
            matrix[row * factors + factor] * matrix[column * factors + factor]
        }

        if (row === column) {
          if (value <= 0 || !Number.isFinite(value)) {
            throw new Error("Невозможно вычислить вектор пользователя ALS")
          }
          matrix[index] = Math.sqrt(value)
        } else {
          matrix[index] = value / matrix[column * factors + column]
        }
      }

      for (let column = 0; column < row; column += 1) {
        userFactors[row] -= matrix[row * factors + column] * userFactors[column]
      }
      userFactors[row] /= matrix[row * factors + row]
    }

    for (let row = factors - 1; row >= 0; row -= 1) {
      for (let column = row + 1; column < factors; column += 1) {
        userFactors[row] -= matrix[column * factors + row] * userFactors[column]
      }
      userFactors[row] /= matrix[row * factors + row]
    }

    for (const itemIndex of candidateIndices) {
      const start = itemIndex * factors
      let score = 0

      for (let factor = 0; factor < factors; factor += 1) {
        score += itemFactors[start + factor] * userFactors[factor]
      }

      scores[itemIndex] = score
    }
  }

  return rankRecommendationCandidates({
    itemIds,
    popularity,
    scores,
    candidateIndices,
  })
}

export { calculateAlsCandidates }
