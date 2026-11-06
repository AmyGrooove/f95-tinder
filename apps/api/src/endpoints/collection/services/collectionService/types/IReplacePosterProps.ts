import type { Types } from "mongoose"

interface IReplacePosterProps {
  id: Types.ObjectId
  src: string | undefined
}

export type { IReplacePosterProps }
