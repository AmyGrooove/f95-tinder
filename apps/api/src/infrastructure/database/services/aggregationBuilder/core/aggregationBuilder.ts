import type { PipelineStage, UpdateAggregationStage } from "mongoose"

class AggregationBuilder<TStage extends PipelineStage = PipelineStage> {
  private readonly stages: TStage[] = []

  static forLookup() {
    return new AggregationBuilder<
      NonNullable<PipelineStage.Lookup["$lookup"]["pipeline"]>[number]
    >()
  }

  static forFacet() {
    return new AggregationBuilder<PipelineStage.FacetPipelineStage>()
  }

  static forUpdate() {
    return new AggregationBuilder<
      Extract<PipelineStage, UpdateAggregationStage>
    >()
  }

  match<TBuilder>(
    this: { use: (stage: PipelineStage.Match) => TBuilder },
    filter: PipelineStage.Match["$match"],
  ) {
    return this.use({ $match: filter })
  }

  sort<TBuilder>(
    this: { use: (stage: PipelineStage.Sort) => TBuilder },
    fields: PipelineStage.Sort["$sort"],
  ) {
    return this.use({ $sort: fields })
  }

  limit<TBuilder>(
    this: { use: (stage: PipelineStage.Limit) => TBuilder },
    count: number,
  ) {
    return this.use({ $limit: count })
  }

  project<TBuilder>(
    this: { use: (stage: PipelineStage.Project) => TBuilder },
    fields: PipelineStage.Project["$project"],
  ) {
    return this.use({ $project: fields })
  }

  use = (...stages: TStage[]) => {
    this.stages.push(...stages)

    return this
  }

  build(): TStage[] {
    return [...this.stages]
  }
}

export { AggregationBuilder }
