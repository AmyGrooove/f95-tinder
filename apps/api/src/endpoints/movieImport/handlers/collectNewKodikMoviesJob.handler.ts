import { Injectable } from "@nestjs/common"

import { JobHandler } from "@infrastructure/jobs/decorators/JobHandler"
import type { JobContext } from "@infrastructure/jobs/types/JobContext"

import { KodikMoviesService } from "../services/kodikMovies.service"
import { COLLECT_NEW_KODIK_MOVIES_JOB } from "../static/COLLECT_NEW_KODIK_MOVIES_JOB"

@Injectable()
@JobHandler(COLLECT_NEW_KODIK_MOVIES_JOB)
class CollectNewKodikMoviesJobHandler {
  constructor(private readonly kodikMoviesService: KodikMoviesService) {}

  handle(_payload: Record<string, never>, context: JobContext) {
    return this.kodikMoviesService.collect(context)
  }
}

export { CollectNewKodikMoviesJobHandler }
