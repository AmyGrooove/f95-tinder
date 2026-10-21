import type { Connection } from "mongoose"

import type { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { applyTimestampsPlugin } from "../../applyTimestampsPlugin"
import { applyToJsonPlugin } from "../../applyToJsonPlugin"
import { applyVersionKeyPlugin } from "../../applyVersionKeyPlugin"

const createDatabaseOptions = (
  configurationService: InfrastructureConfigService,
) => {
  return {
    uri: configurationService.database.uri,
    autoIndex: true,
    connectionFactory: (connection: Connection) => {
      connection.plugin(applyTimestampsPlugin)
      connection.plugin(applyVersionKeyPlugin)
      connection.plugin(applyToJsonPlugin)

      return connection
    },
  }
}

export { createDatabaseOptions }
