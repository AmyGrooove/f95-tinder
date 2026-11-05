import type { Types } from "mongoose"

import type { CreateAttemptBodyDto } from "../dto/createAttempt.body"

interface ICreateAttemptProps {
  id: Types.ObjectId
  body: CreateAttemptBodyDto
}

export type { ICreateAttemptProps }
