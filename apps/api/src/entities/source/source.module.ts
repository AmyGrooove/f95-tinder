import { Module } from "@nestjs/common"
import { HttpClientModule } from "@nestjs/http-client"
import { MongooseModule } from "@nestjs/mongoose"

import { InfrastructureConfigModule } from "@infrastructure/config/config.module"
import { StorageModule } from "@infrastructure/storage/storage.module"

import { Source, SourceSchema } from "./schemas/source.schema"
import { KodikService } from "./services/kodik.service"
import { PageCollectorService } from "./services/pageCollector.service"
import { SourceDataWriterService } from "./services/sourceDataWriter.service"
import { SourceRepository } from "./services/source.repository"
import { KODIK_SETTINGS } from "./static/KODIK_SETTINGS"

@Module({
  imports: [
    InfrastructureConfigModule,
    StorageModule,
    HttpClientModule.register({
      name: KODIK_SETTINGS.clientName,
      baseUrl: KODIK_SETTINGS.apiUrl,
      timeout: KODIK_SETTINGS.requestTimeoutMs,
      retry: false,
      redirect: "error",
      throwOnHttpError: true,
    }),
    MongooseModule.forFeature([{ name: Source.name, schema: SourceSchema }]),
  ],
  providers: [
    SourceRepository,
    PageCollectorService,
    KodikService,
    SourceDataWriterService,
  ],
  exports: [
    SourceRepository,
    PageCollectorService,
    KodikService,
    SourceDataWriterService,
  ],
})
class SourceModule {}

export { SourceModule }
