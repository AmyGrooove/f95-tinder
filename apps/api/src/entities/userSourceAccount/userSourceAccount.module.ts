import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"

import {
  UserSourceAccount,
  UserSourceAccountSchema,
} from "./schemas/userSourceAccount.schema"
import { UserSourceAccountRepository } from "./services/userSourceAccount.repository"

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSourceAccount.name, schema: UserSourceAccountSchema },
    ]),
  ],
  providers: [UserSourceAccountRepository],
  exports: [UserSourceAccountRepository],
})
class UserSourceAccountModule {}

export { UserSourceAccountModule }
