import { Types } from "mongoose"

import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isObject } from "@shared/functions/checks/isObject"
import { isString } from "@shared/functions/checks/isString"

import type { IRecommendationModel } from "../../../types/IRecommendationModel"

const checkIsRecord = (value: unknown): value is Record<string, unknown> => {
  return isObject(value) && !Array.isArray(value)
}

const readInt32Array = (buffer: Buffer) => {
  const size = Int32Array.BYTES_PER_ELEMENT
  return Int32Array.from({ length: buffer.length / size }, (_, index) =>
    buffer.readInt32LE(index * size),
  )
}

const readFloat32Array = (buffer: Buffer) => {
  const size = Float32Array.BYTES_PER_ELEMENT
  return Float32Array.from({ length: buffer.length / size }, (_, index) =>
    buffer.readFloatLE(index * size),
  )
}

const calculateGram = (itemFactors: Float32Array, factors: number) => {
  const gram = new Float64Array(factors * factors)

  for (let start = 0; start < itemFactors.length; start += factors) {
    for (let row = 0; row < factors; row += 1) {
      const itemFactor = itemFactors[start + row]
      for (let column = 0; column <= row; column += 1) {
        gram[row * factors + column] += itemFactor * itemFactors[start + column]
      }
    }
  }

  return gram
}

const decodeRecommendationModel = (
  document: Record<string, unknown>,
): IRecommendationModel => {
  const { _id, trainedAt, formatVersion, itemIds, itemCF, als, popularity } =
    document

  if (formatVersion !== 1) {
    throw new Error("Версия формата модели рекомендаций не поддерживается")
  }

  if (
    !(_id instanceof Types.ObjectId) ||
    !(trainedAt instanceof Date) ||
    !Number.isFinite(trainedAt.getTime()) ||
    !Array.isArray(itemIds) ||
    itemIds.length === 0 ||
    !itemIds.every(isString) ||
    itemIds.some((id) => id.length === 0) ||
    new Set(itemIds).size !== itemIds.length
  ) {
    throw new Error("Некорректные метаданные модели рекомендаций")
  }

  if (!checkIsRecord(itemCF) || !checkIsRecord(als)) {
    throw new Error("В модели отсутствуют данные ItemCF или ALS")
  }

  const itemCount = itemIds.length
  const { offsets, indices, weights } = itemCF
  const { factors, alpha, regularization, itemFactors } = als
  const intSize = Int32Array.BYTES_PER_ELEMENT
  const floatSize = Float32Array.BYTES_PER_ELEMENT

  if (
    !Buffer.isBuffer(offsets) ||
    offsets.length !== (itemCount + 1) * intSize ||
    !Buffer.isBuffer(indices) ||
    indices.length % intSize !== 0 ||
    !Buffer.isBuffer(weights) ||
    weights.length !== (indices.length / intSize) * floatSize
  ) {
    throw new Error("Некорректные размеры массивов ItemCF")
  }

  if (
    !isFiniteNumber(factors) ||
    !Number.isSafeInteger(factors) ||
    factors <= 0 ||
    !isFiniteNumber(alpha) ||
    alpha <= 0 ||
    !isFiniteNumber(regularization) ||
    regularization < 0 ||
    !Buffer.isBuffer(itemFactors) ||
    itemFactors.length !== itemCount * factors * floatSize
  ) {
    throw new Error("Некорректные параметры или размеры массивов ALS")
  }

  if (
    !Buffer.isBuffer(popularity) ||
    popularity.length !== itemCount * floatSize
  ) {
    throw new Error("Некорректный размер массива популярности")
  }

  const cfOffsets = readInt32Array(offsets)
  const cfIndices = readInt32Array(indices)
  if (
    cfOffsets[0] !== 0 ||
    cfOffsets[itemCount] !== cfIndices.length ||
    cfOffsets.some(
      (offset, index) => index > 0 && offset < cfOffsets[index - 1],
    ) ||
    cfIndices.some((index) => index < 0 || index >= itemCount)
  ) {
    throw new Error("Некорректные индексы соседей ItemCF")
  }

  const cfWeights = readFloat32Array(weights)
  const alsItemFactors = readFloat32Array(itemFactors)
  const itemPopularity = readFloat32Array(popularity)
  if (
    cfWeights.some((weight) => !Number.isFinite(weight) || weight < 0) ||
    alsItemFactors.some((factor) => !Number.isFinite(factor)) ||
    itemPopularity.some((count) => !Number.isInteger(count) || count < 0)
  ) {
    throw new Error("Некорректные числовые значения модели рекомендаций")
  }

  return {
    id: _id.toHexString(),
    trainedAt,
    itemIds,
    itemCF: { offsets: cfOffsets, indices: cfIndices, weights: cfWeights },
    als: {
      factors,
      alpha,
      regularization,
      itemFactors: alsItemFactors,
      gram: calculateGram(alsItemFactors, factors),
    },
    popularity: itemPopularity,
  }
}

export { decodeRecommendationModel }
