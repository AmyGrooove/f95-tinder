import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { DatabaseModule } from "@infrastructure/database/database.module"

import {
  UserGameState,
  UserGameStateSchema,
} from "./schemas/userGameState.schema"
import { UserGameStateRepository } from "./services/userGameState.repository"

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([
      { name: UserGameState.name, schema: UserGameStateSchema },
    ]),
  ],
  providers: [UserGameStateRepository],
  exports: [UserGameStateRepository],
})
class UserGameStateModule {}

export { UserGameStateModule }
