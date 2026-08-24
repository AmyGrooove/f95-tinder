import { Injectable } from "@nestjs/common"
import { Cron } from "@nestjs/schedule"

import { CatalogSyncService } from "../services/catalogSync.service"

@Injectable()
class CatalogSyncCron {
  constructor(private readonly catalogSyncService: CatalogSyncService) {}

  @Cron("0 1 1 1 *")
  async syncFullCatalog() {
    try {
      await this.catalogSyncService.syncFullCatalog()
    } catch {
      return
    }
  }

  @Cron("0 */4 * * *")
  async syncLatestCatalogUpdates() {
    try {
      await this.catalogSyncService.syncLatestCatalogUpdates()
    } catch {
      return
    }
  }
}

export { CatalogSyncCron }
