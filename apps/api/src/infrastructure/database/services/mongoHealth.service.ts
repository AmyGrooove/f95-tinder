import { Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import { InjectConnection } from "@nestjs/mongoose"
import type { Connection } from "mongoose"

import { isNil } from "@shared/functions/checks/isNil"
import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class MongoHealthService implements OnApplicationBootstrap {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async onApplicationBootstrap() {
    await this.healthCheck()
  }

  async healthCheck() {
    if (isNil(this.connection.db)) {
      throw new Error(DICTIONARY.database.unavailable)
    }

    await this.connection.db.admin().ping()

    return true
  }
}

export { MongoHealthService }
