import type { Types } from "mongoose"

import type { UpdateAttemptBodyDto } from "../dto/body/updateAttempt.body"

interface IUpdateAttemptProps {
  id: Types.ObjectId
  attemptId: Types.ObjectId
  body: UpdateAttemptBodyDto
}

export type { IUpdateAttemptProps }
