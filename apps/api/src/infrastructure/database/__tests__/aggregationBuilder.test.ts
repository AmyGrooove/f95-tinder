import { describe, expect, it } from "@jest/globals"
import type { PipelineStage } from "mongoose"

import { AggregationBuilder } from "../services/aggregationBuilder"

describe("AggregationBuilder", () => {
  it("возвращает пустой pipeline до добавления стадий", () => {
    expect(new AggregationBuilder().build()).toEqual([])
  })

  it("сохраняет порядок стадий и поддерживает цепочку вызовов", () => {
    const builder = new AggregationBuilder()
    const stages: PipelineStage[] = [
      { $skip: 2 },
      { $group: { _id: "$group", total: { $sum: 1 } } },
    ]

    expect(
      builder
        .match({ score: { $gt: 0 } })
        .sort({ score: -1 })
        .limit(5)
        .project({ key: 1 })
        .use(...stages),
    ).toBe(builder)
    expect(builder.build()).toEqual([
      { $match: { score: { $gt: 0 } } },
      { $sort: { score: -1 } },
      { $limit: 5 },
      { $project: { key: 1 } },
      ...stages,
    ])
  })

  it("возвращает отдельный массив при каждом build", () => {
    const builder = new AggregationBuilder().limit(1)
    const pipeline = builder.build()
    pipeline.push({ $skip: 10 })
    builder.sort({ key: 1 })

    expect(pipeline).toEqual([{ $limit: 1 }, { $skip: 10 }])
    expect(builder.build()).toEqual([{ $limit: 1 }, { $sort: { key: 1 } }])
    expect(builder.build()).not.toBe(builder.build())
  })
})
