import type { Types } from "mongoose"

interface IRecalculateUserTasteProfileProps {
  userId: Types.ObjectId
  itemId: Types.ObjectId
}

export type { IRecalculateUserTasteProfileProps }
