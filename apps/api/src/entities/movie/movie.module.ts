import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Movie, MovieSchema } from "./schemas/movie.schema"
import { MovieRepository } from "./services/movie.repository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Movie.name, schema: MovieSchema }]),
  ],
  providers: [MovieRepository],
  exports: [MovieRepository],
})
class MovieModule {}

export { MovieModule }
