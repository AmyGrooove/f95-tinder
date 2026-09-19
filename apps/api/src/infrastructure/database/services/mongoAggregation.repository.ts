import type { AggregateOptions, PipelineStage } from "mongoose"

import { MongoRepositoryCore } from "./mongoRepositoryCore.repository"

class MongoAggregationRepository<
  TDocument,
> extends MongoRepositoryCore<TDocument> {
  async aggregate<TResult>(
    pipeline: PipelineStage[],
    options?: AggregateOptions,
  ): Promise<TResult[]> {
    const results = await this.model
      .aggregate<TResult>(pipeline, options)
      .exec()

    return results
  }
}

export { MongoAggregationRepository }
