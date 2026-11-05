import type { PipelineStage } from "mongoose"

class AggregationBuilder {
  private readonly stages: PipelineStage[] = []

  match(filter: PipelineStage.Match["$match"]) {
    this.stages.push({ $match: filter })

    return this
  }

  sort(fields: PipelineStage.Sort["$sort"]) {
    this.stages.push({ $sort: fields })

    return this
  }

  limit(count: number) {
    this.stages.push({ $limit: count })

    return this
  }

  project(fields: PipelineStage.Project["$project"]) {
    this.stages.push({ $project: fields })

    return this
  }

  use(...stages: PipelineStage[]) {
    this.stages.push(...stages)

    return this
  }

  build(): PipelineStage[] {
    return [...this.stages]
  }
}

export { AggregationBuilder }
