import { Injectable } from "@nestjs/common"

import { isNil } from "@shared/functions/checks/isNil"

import type { TJobType } from "../types/IJobPayloadMap"

@Injectable()
class JobConcurrencyService {
  private readonly activeCounts = new Map<TJobType, number>()
  private readonly waiters = new Map<TJobType, Array<() => void>>()

  async run<T>(type: TJobType, limit: number, callback: () => Promise<T> | T) {
    await this.acquire(type, limit)

    try {
      return await callback()
    } finally {
      this.release(type)
    }
  }

  private async acquire(type: TJobType, limit: number) {
    const activeCount = this.activeCounts.get(type) ?? 0

    if (activeCount < limit) {
      this.activeCounts.set(type, activeCount + 1)

      return
    }

    await new Promise<void>((resolve) => {
      const waiters = this.waiters.get(type) ?? []
      waiters.push(resolve)
      this.waiters.set(type, waiters)
    })
  }

  private release(type: TJobType) {
    const waiter = this.waiters.get(type)?.shift()

    if (!isNil(waiter)) {
      waiter()

      return
    }

    const activeCount = this.activeCounts.get(type) ?? 0
    this.activeCounts.set(type, Math.max(0, activeCount - 1))
  }
}

export { JobConcurrencyService }
