import type { Types } from "mongoose"

interface IReadSearchIndexBatchProps {
  limit: number

  afterId?: Types.ObjectId
}

export type { IReadSearchIndexBatchProps }
