import type { Types } from "mongoose"

import type { CreateAttemptBodyDto } from "@endpoints/userItem/dto/body/createAttempt.body"

interface ICreateAttemptProps {
  id: Types.ObjectId
  body: CreateAttemptBodyDto
}

export type { ICreateAttemptProps }
