import type { Types } from "mongoose"

import type { CreateAttemptBodyDto } from "../dto/body/createAttempt.body"

interface ICreateAttemptProps {
  id: Types.ObjectId
  body: CreateAttemptBodyDto
}

export type { ICreateAttemptProps }
