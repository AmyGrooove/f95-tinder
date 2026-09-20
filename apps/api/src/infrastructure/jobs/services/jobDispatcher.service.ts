import { InjectQueue } from "@nestjs/bullmq"
import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common"
import { type Queue, Worker } from "bullmq"
import { isNil } from "@shared/functions/checks/isNil"
import { InfrastructureConfigService } from "../../config/services/config.service"
import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"
import type { TJobType } from "../types/IJobPayloadMap"
import { JobProcessorService } from "./jobProcessor.service"
import { JobRegistry } from "./jobRegistry.service"

@Injectable()
class JobDispatcher implements OnApplicationBootstrap, OnModuleDestroy {
  private worker?: Worker

  constructor(
    @InjectQueue(JOBS_QUEUE_NAME) private readonly jobsQueue: Queue,
    private readonly infrastructureConfigService: InfrastructureConfigService,
    private readonly jobRegistry: JobRegistry,
    private readonly jobProcessorService: JobProcessorService,
  ) {}

  onApplicationBootstrap() {
    const concurrency = this.jobRegistry.getConcurrency()

    if (concurrency === 0) {
      return
    }

    this.worker = new Worker(
      JOBS_QUEUE_NAME,
      (job) => this.jobProcessorService.process(job),
      {
        connection: {
          db: this.infrastructureConfigService.redis.database,
          host: this.infrastructureConfigService.redis.host,
          password: this.infrastructureConfigService.redis.password,
          port: this.infrastructureConfigService.redis.port,
          tls: this.infrastructureConfigService.redis.isTls ? {} : undefined,
          username: this.infrastructureConfigService.redis.username,
        },
        concurrency,
        prefix: this.infrastructureConfigService.app.name,
        settings: {
          backoffStrategy: (attemptsMade, _type, _error, job) => {
            const handler = this.jobRegistry.get(job?.name as TJobType)

            if (isNil(handler)) {
              throw new Error("No handler is registered for retrying job")
            }

            return handler.options.retryDelays[attemptsMade - 1] ?? -1
          },
        },
      },
    )
  }

  async onModuleDestroy() {
    await this.worker?.close()
  }
}

export { JobDispatcher }
