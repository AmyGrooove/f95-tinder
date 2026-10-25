import type { ClientSession, Types } from "mongoose"

interface IValidateCompletionProps {
  itemId: Types.ObjectId
  isCompletionRequested: boolean

  session?: ClientSession
}

export type { IValidateCompletionProps }
