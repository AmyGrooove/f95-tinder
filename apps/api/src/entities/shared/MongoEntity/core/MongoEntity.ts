import type { Types } from "mongoose"

abstract class MongoEntity {
  declare _id: Types.ObjectId

  declare createdAt: Date

  declare updatedAt: Date
}

export { MongoEntity }
