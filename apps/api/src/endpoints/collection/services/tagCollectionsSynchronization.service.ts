import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common"
import type { Types } from "mongoose"

import { ItemTagEventsService } from "@entities/itemTag/services/itemTagEvents.service"
import { JobService } from "@infrastructure/jobs/services/job.service"

import { SYNCHRONIZE_TAG_COLLECTIONS_JOB } from "../static/SYNCHRONIZE_TAG_COLLECTIONS_JOB"

@Injectable()
class TagCollectionsSynchronizationService
  implements OnModuleInit, OnModuleDestroy
{
  private unsubscribe?: () => void

  constructor(
    private readonly events: ItemTagEventsService,
    private readonly jobs: JobService,
  ) {}

  onModuleInit() {
    this.unsubscribe = this.events.subscribe(async (itemIds) => {
      for (const itemId of itemIds) {
        await this.enqueue(itemId)
      }
    })
  }

  onModuleDestroy() {
    this.unsubscribe?.()
  }

  async enqueue(itemId: Types.ObjectId) {
    return await this.jobs.add(
      SYNCHRONIZE_TAG_COLLECTIONS_JOB,
      itemId.toHexString(),
      {
        deduplication: {
          id: `${SYNCHRONIZE_TAG_COLLECTIONS_JOB.name}:${itemId}`,
          keepLastIfActive: true,
        },
      },
    )
  }
}

export { TagCollectionsSynchronizationService }
