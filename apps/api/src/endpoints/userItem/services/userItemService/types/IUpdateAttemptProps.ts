import type { Types } from "mongoose"

import type { UpdateAttemptBodyDto } from "../dto/updateAttempt.body"

interface IUpdateAttemptProps {
  id: Types.ObjectId
  attemptId: Types.ObjectId
  body: UpdateAttemptBodyDto
}

export type { IUpdateAttemptProps }
