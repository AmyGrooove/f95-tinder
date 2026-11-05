import type { Types } from "mongoose"

interface IReissueAccessCodeProps {
  userId: Types.ObjectId
  accessCode: string
}

export type { IReissueAccessCodeProps }
