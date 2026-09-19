import { Module } from "@nestjs/common"
import { Client } from "minio"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { InfrastructureConfigService } from "@infrastructure/config/services/config.service"
import { isNil } from "@shared/functions/checks/isNil"

import { ImageUploadInterceptor } from "./interceptors/imageUpload.interceptor"
import { ImageProcessingService } from "./services/imageProcessing.service"
import { StorageHealthService } from "./services/storageHealth.service"
import { StorageService } from "./services/storage.service"
import { STORAGE_CLIENT } from "./static/STORAGE_CLIENT"

@Module({
  imports: [InfrastructureConfigModule],
  providers: [
    {
      provide: STORAGE_CLIENT,
      inject: [InfrastructureConfigService],
      useFactory: (configurationService: InfrastructureConfigService) => {
        const storage = configurationService.storage

        if (
          isNil(storage.endpoint) ||
          storage.endpoint === "" ||
          isNil(storage.accessKey) ||
          storage.accessKey === "" ||
          isNil(storage.secretKey) ||
          storage.secretKey === ""
        ) {
          throw new Error("MinIO URL and credentials must be configured")
        }

        let endpoint: URL

        try {
          endpoint = new URL(storage.endpoint)
        } catch {
          throw new Error("MINIO_URL must be a valid HTTP(S) URL")
        }

        if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
          throw new Error("MINIO_URL must use HTTP or HTTPS")
        }

        const endpointPort =
          endpoint.port !== "" ? Number(endpoint.port) : undefined

        return new Client({
          endPoint: endpoint.hostname,
          port: endpointPort,
          useSSL: endpoint.protocol === "https:",
          accessKey: storage.accessKey,
          secretKey: storage.secretKey,
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
