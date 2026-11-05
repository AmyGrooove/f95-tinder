import { Module } from "@nestjs/common"
import { S3Client } from "@aws-sdk/client-s3"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/configService"
import { LoggerModule } from "@infrastructure/logger/logger.module"
import { isNil } from "@shared/functions/checks/isNil"

import { ImageUploadInterceptor } from "@infrastructure/storage/services/imageUploadInterceptor"
import { ImageProcessingService } from "@infrastructure/storage/services/imageProcessingService"
import { StorageHealthService } from "@infrastructure/storage/services/storageHealthService"
import { StorageService } from "@infrastructure/storage/services/storageService"
import { STORAGE_CLIENT } from "./static/STORAGE_CLIENT"
import { DICTIONARY } from "@shared/static/DICTIONARY"

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
          throw new Error(DICTIONARY.storage.configurationRequired)
        }

        let endpoint: URL

        try {
          endpoint = new URL(storage.endpoint)
        } catch {
          throw new Error(DICTIONARY.storage.invalidEndpointUrl)
        }

        if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
          throw new Error(DICTIONARY.storage.invalidEndpointProtocol)
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
