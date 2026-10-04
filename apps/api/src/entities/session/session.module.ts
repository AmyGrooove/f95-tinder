import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { Session, SessionSchema } from "./schemas/session.schema"
import { SessionRepository } from "./services/session.repository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
  ],
  providers: [SessionRepository],
  exports: [SessionRepository],
})
class SessionModule {}

export { SessionModule }
