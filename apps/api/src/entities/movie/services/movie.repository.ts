import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { MongoReadRepository } from "@infrastructure/database/services/mongoRead.repository"
import { MongoWriteRepository } from "@infrastructure/database/services/mongoWrite.repository"
import { MongoPaginationRepository } from "@infrastructure/database/services/mongoPagination.repository"
import { MongoBulkRepository } from "@infrastructure/database/services/mongoBulk.repository"
import { MongoAggregationRepository } from "@infrastructure/database/services/mongoAggregation.repository"

import { Movie } from "../schemas/movie.schema"
import type { TCreateMovie } from "../schemas/movie.schema"

@Injectable()
class MovieRepository {
  readonly read: MongoReadRepository<Movie, HydratedDocument<Movie>>
  readonly write: MongoWriteRepository<
    Movie,
    HydratedDocument<Movie>,
    TCreateMovie
  >
  readonly pagination: MongoPaginationRepository<Movie, HydratedDocument<Movie>>
  readonly bulk: MongoBulkRepository<
    Movie,
    HydratedDocument<Movie>,
    TCreateMovie
  >
  readonly aggregation: MongoAggregationRepository<HydratedDocument<Movie>>

  constructor(@InjectModel(Movie.name) model: Model<HydratedDocument<Movie>>) {
    this.read = new MongoReadRepository<Movie, HydratedDocument<Movie>>(model)
    this.write = new MongoWriteRepository<
      Movie,
      HydratedDocument<Movie>,
      TCreateMovie
    >(model)
    this.pagination = new MongoPaginationRepository<
      Movie,
      HydratedDocument<Movie>
    >(model)
    this.bulk = new MongoBulkRepository<
      Movie,
      HydratedDocument<Movie>,
      TCreateMovie
    >(model)
    this.aggregation = new MongoAggregationRepository<HydratedDocument<Movie>>(
      model,
    )
  }
}

export { MovieRepository }
