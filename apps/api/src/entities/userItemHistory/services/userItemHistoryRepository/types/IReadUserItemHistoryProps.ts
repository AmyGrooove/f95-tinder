import type { Types } from "mongoose"

interface IReadUserItemHistoryProps {
  userId: Types.ObjectId
  limit: number

  after?: { createdAt: Date; id: Types.ObjectId }
}

export type { IReadUserItemHistoryProps }
