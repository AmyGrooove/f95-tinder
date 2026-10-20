import type { AggregateOptions, PipelineStage } from "mongoose"

import { MongoCoreRepository } from "./mongoCore.repository"

class MongoAggregationRepository<
  TDocument,
> extends MongoCoreRepository<TDocument> {
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
