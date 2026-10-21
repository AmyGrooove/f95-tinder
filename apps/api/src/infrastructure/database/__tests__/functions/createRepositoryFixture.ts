import { Schema } from "mongoose"
import type { HydratedDocument, Model } from "mongoose"

import { getTestApplication } from "@test/setup/setupIntegration"

import { MongoAggregationRepository } from "../../services/mongoAggregation.repository"
import { MongoBulkRepository } from "../../services/mongoBulk.repository"
import { MongoPaginationRepository } from "../../services/mongoPagination.repository"
import { MongoReadRepository } from "../../services/mongoRead.repository"
import { MongoWriteRepository } from "../../services/mongoWrite.repository"

interface IRepositoryRecord {
  key: string
  score: number
  group: string
}

const createRepositoryFixture = async (name: string) => {
  const { connection } = getTestApplication()
  const schema = new Schema<IRepositoryRecord>({
    key: { type: String, required: true, unique: true },
    score: { type: Number, required: true, min: 0 },
    group: { type: String, default: "first" },
  })
  const model = connection.model(name, schema)
  await model.init()

  type TDocument = HydratedDocument<IRepositoryRecord>
  type TCreate = Pick<IRepositoryRecord, "key" | "score"> &
    Partial<Pick<IRepositoryRecord, "group">>
  const repositoryModel = model as unknown as Model<TDocument>

  return {
    model,
    connection,
    read: new MongoReadRepository<IRepositoryRecord, TDocument>(
      repositoryModel,
      {
        defaultSort: { score: -1 },
      },
    ),
    write: new MongoWriteRepository<IRepositoryRecord, TDocument, TCreate>(
      repositoryModel,
    ),
    bulk: new MongoBulkRepository<IRepositoryRecord, TDocument, TCreate>(
      repositoryModel,
    ),
    pagination: new MongoPaginationRepository<IRepositoryRecord, TDocument>(
      repositoryModel,
      { defaultSort: { score: -1 } },
    ),
    aggregation: new MongoAggregationRepository<TDocument>(repositoryModel),
  }
}

export { createRepositoryFixture }
