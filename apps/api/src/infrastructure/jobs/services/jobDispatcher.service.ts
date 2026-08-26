import { InjectQueue } from "@nestjs/bullmq"
import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common"
import { type Queue, Worker } from "bullmq"
import { JOBS_QUEUE_NAME } from "../static/JOBS_QUEUE_NAME"
import { InfrastructureConfigService } from "../../config/services/config.service"
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
      },
    )
  }

  async onModuleDestroy() {
    await this.worker?.close()
  }
}

export { JobDispatcher }
