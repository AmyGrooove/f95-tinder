import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import { User, UserSchema } from "./schemas/user.schema"
import { UserRepository } from "@entities/user/services/userRepository"

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UserRepository],
  exports: [UserRepository],
})
class UserModule {}

export { UserModule }
