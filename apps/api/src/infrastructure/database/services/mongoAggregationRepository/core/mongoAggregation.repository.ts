import type { AggregateOptions, PipelineStage } from "mongoose"

import { MongoCoreRepository } from "@infrastructure/database/services/mongoCoreRepository"

class MongoAggregationRepository<
  TDocument,
> extends MongoCoreRepository<TDocument> {
  async aggregate<TResult>(
    pipeline: PipelineStage[],
    options?: AggregateOptions,
  ) {
    const results = await this.model
      .aggregate<TResult>(pipeline, options)
      .exec()

    return results
  }
}

export { MongoAggregationRepository }
