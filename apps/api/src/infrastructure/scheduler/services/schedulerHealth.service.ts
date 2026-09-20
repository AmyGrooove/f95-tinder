import { Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"

import { SCHEDULER_HEALTH_TIMEOUT_MS } from "../static/SCHEDULER_HEALTH_TIMEOUT_MS"

@Injectable()
class SchedulerHealthService implements OnApplicationBootstrap {
  private startedAt = performance.now()
  private lastHeartbeatAt: number | undefined

  onApplicationBootstrap() {
    this.startedAt = performance.now()
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  private recordHeartbeat() {
    this.lastHeartbeatAt = performance.now()
  }

  checkHealth() {
    const lastRunAt = this.lastHeartbeatAt ?? this.startedAt

    return performance.now() - lastRunAt <= SCHEDULER_HEALTH_TIMEOUT_MS
  }
}

export { SchedulerHealthService }
