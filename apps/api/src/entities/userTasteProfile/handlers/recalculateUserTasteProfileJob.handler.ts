import { Injectable } from "@nestjs/common"
import { Types } from "mongoose"

import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"
import type { IJobHandler } from "@infrastructure/jobs/types/IJobHandler"

import { UserTasteProfileRecalculationService } from "../services/userTasteProfileRecalculation.service"
import { RECALCULATE_USER_TASTE_PROFILE_JOB } from "../static/RECALCULATE_USER_TASTE_PROFILE_JOB"

@Injectable()
@JobHandler(RECALCULATE_USER_TASTE_PROFILE_JOB)
class RecalculateUserTasteProfileJobHandler implements IJobHandler<string> {
  constructor(
    private readonly recalculationService: UserTasteProfileRecalculationService,
  ) {}

  async handle(userId: string, context: IJobContext) {
    return await this.recalculationService.recalculate(
      new Types.ObjectId(userId),
      context,
    )
  }
}

export { RecalculateUserTasteProfileJobHandler }
