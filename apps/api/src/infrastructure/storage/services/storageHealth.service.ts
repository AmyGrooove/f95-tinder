import { Inject, Injectable } from "@nestjs/common"
import { HeadBucketCommand } from "@aws-sdk/client-s3"
import type { S3Client } from "@aws-sdk/client-s3"

import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"

import { STORAGE_CLIENT } from "../static/STORAGE_CLIENT"

@Injectable()
class StorageHealthService {
  constructor(
    @Inject(STORAGE_CLIENT) private readonly storageClient: S3Client,
    private readonly configurationService: InfrastructureConfigService,
  ) {}

  async healthCheck(): Promise<boolean> {
    try {
      await this.storageClient.send(
        new HeadBucketCommand({
          Bucket: this.configurationService.app.name,
        }),
      )

      return true
    } catch {
      return false
    }
  }
}

export { StorageHealthService }
