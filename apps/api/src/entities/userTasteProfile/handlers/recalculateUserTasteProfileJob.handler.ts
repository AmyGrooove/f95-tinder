import { Injectable } from "@nestjs/common"
import { Types } from "mongoose"

import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import type { IJobHandler } from "@infrastructure/jobs/types/IJobHandler"

import { UserTasteProfileRecalculationService } from "../services/userTasteProfileRecalculation.service"
import { RECALCULATE_USER_TASTE_PROFILE_JOB } from "../static/RECALCULATE_USER_TASTE_PROFILE_JOB"
import type { IRecalculateUserTasteProfilePayload } from "../types/IRecalculateUserTasteProfilePayload"

@Injectable()
@JobHandler(RECALCULATE_USER_TASTE_PROFILE_JOB)
class RecalculateUserTasteProfileJobHandler implements IJobHandler<IRecalculateUserTasteProfilePayload> {
  constructor(
    private readonly recalculationService: UserTasteProfileRecalculationService,
  ) {}

  async handle(
    payload: IRecalculateUserTasteProfilePayload,
    context: IJobContext,
  ) {
    return await this.recalculationService.recalculate(
      {
        userId: new Types.ObjectId(payload.userId),
        itemId: new Types.ObjectId(payload.itemId),
      },
      context,
    )
  }
}

export { RecalculateUserTasteProfileJobHandler }
