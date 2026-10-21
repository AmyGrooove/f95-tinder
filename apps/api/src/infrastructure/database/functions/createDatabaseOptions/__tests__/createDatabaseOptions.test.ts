import { describe, expect, it } from "@jest/globals"
import { Mongoose, Schema } from "mongoose"

import { createDatabaseOptions } from "../core/createDatabaseOptions"
import type { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

describe("createDatabaseOptions", () => {
  it("берёт URI из конфигурации и регистрирует плагины на соединении", async () => {
    const configuration = {
      database: { uri: "mongodb://localhost/test" },
    } as InfrastructureConfigService
    const options = createDatabaseOptions(configuration)
    const connection = new Mongoose().createConnection()

    try {
      expect(options.uri).toBe("mongodb://localhost/test")
      expect(options.autoIndex).toBe(true)
      expect(options.connectionFactory(connection)).toBe(connection)

      const schema = new Schema({ name: String })
      const Model = connection.model("Record", schema)
      const document = new Model({ name: "value" })

      expect(Model.schema.get("timestamps")).toBe(true)
      expect(Model.schema.get("versionKey")).toBe(false)
      expect(document.toJSON()).toStrictEqual({
        name: "value",
        id: document._id.toString(),
      })
    } finally {
      await connection.close()
    }
  })
})
