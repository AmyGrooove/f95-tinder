import { Inject, Injectable } from "@nestjs/common"
import type { Client } from "minio"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { STORAGE_CLIENT } from "../static/STORAGE_CLIENT"

@Injectable()
class StorageHealthService {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly storageClient: Client,
    private readonly configurationService: InfrastructureConfigService,
  ) {}

  async healthCheck(): Promise<boolean> {
    try {
      return await this.storageClient.bucketExists(
        this.configurationService.app.name,
      )
    } catch {
      return false
    }
  }
}

export { StorageHealthService }
