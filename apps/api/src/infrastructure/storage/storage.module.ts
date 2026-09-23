import { Module } from "@nestjs/common"
import { S3Client } from "@aws-sdk/client-s3"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { isNil } from "@shared/functions/checks/isNil"

import { ImageUploadInterceptor } from "./interceptors/imageUpload.interceptor"
import { ImageProcessingService } from "./services/imageProcessing.service"
import { StorageHealthService } from "./services/storageHealth.service"
import { StorageService } from "./services/storage.service"
import { STORAGE_CLIENT } from "./static/STORAGE_CLIENT"

@Module({
  imports: [InfrastructureConfigModule, LoggerModule],
  providers: [
    {
      provide: STORAGE_CLIENT,
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        const storage = configurationService.storage

        if (
          isNil(storage.endpoint) ||
          storage.endpoint === "" ||
          isNil(storage.region) ||
          storage.region === "" ||
          isNil(storage.accessKey) ||
          storage.accessKey === "" ||
          isNil(storage.secretKey) ||
          storage.secretKey === ""
        ) {
          throw new Error(
            "Garage URL, region, and credentials must be configured",
          )
        }

        let endpoint: URL

        try {
          endpoint = new URL(storage.endpoint)
        } catch {
          throw new Error("GARAGE_URL must be a valid HTTP(S) URL")
        }

        if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
          throw new Error("GARAGE_URL must use HTTP or HTTPS")
        }

        return new S3Client({
          endpoint: endpoint.toString(),
          region: storage.region,
          forcePathStyle: true,
          requestChecksumCalculation: "WHEN_REQUIRED",
          responseChecksumValidation: "WHEN_REQUIRED",
          credentials: {
            accessKeyId: storage.accessKey,
            secretAccessKey: storage.secretKey,
          },
        })
      },
    },
    ImageProcessingService,
    ImageUploadInterceptor,
    StorageHealthService,
    StorageService,
  ],
  exports: [StorageHealthService, StorageService],
})
class StorageModule {}

export { StorageModule }
