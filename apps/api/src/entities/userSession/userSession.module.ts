import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { UserSession, UserSessionSchema } from "./schemas/userSession.schema"
import { UserSessionRepository } from "./services/userSession.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSession.name, schema: UserSessionSchema },
    ]),
  ],
  providers: [UserSessionRepository],
  exports: [UserSessionRepository],
})
class UserSessionModule {}

export { UserSessionModule }
