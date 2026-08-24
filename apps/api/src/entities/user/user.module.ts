import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { DatabaseModule } from "@infrastructure/database/database.module"

import { User, UserSchema } from "./schemas/user.schema"
import { UserRepository } from "./services/user.repository"

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UserRepository],
  exports: [UserRepository],
})
class UserModule {}

export { UserModule }
