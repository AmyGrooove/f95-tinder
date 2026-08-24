import { Controller, Get, Post, UseGuards } from "@nestjs/common"
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger"

import { Roles } from "@infrastructure/security/decorators/Roles"
import { AccessTokenGuard } from "@infrastructure/security/guards/accessToken.guard"
import { RoleGuard } from "@infrastructure/security/guards/role.guard"

import { CatalogSyncService } from "../services/catalogSync.service"
import { CatalogSyncStatusService } from "../services/catalogSyncStatus.service"

@ApiTags("Sync")
@ApiBearerAuth("authToken")
@Controller("admin/sync")
@UseGuards(AccessTokenGuard, RoleGuard)
@Roles("admin")
class SyncController {
  constructor(
    private readonly catalogSyncService: CatalogSyncService,
    private readonly catalogSyncStatusService: CatalogSyncStatusService,
  ) {}

  @Post("catalog/full")
  @ApiOperation({ summary: "Sync the full F95 game catalog" })
  @ApiOkResponse({ description: "Current catalog sync status" })
  syncFullCatalog() {
    return this.catalogSyncService.startFullCatalog()
  }

  @Post("catalog/latest")
  @ApiOperation({ summary: "Sync latest F95 game updates" })
  @ApiOkResponse({ description: "Current catalog sync status" })
  syncLatestCatalogUpdates() {
    return this.catalogSyncService.startLatestCatalogUpdates()
  }

  @Post("catalog/pause")
  @ApiOperation({ summary: "Pause current catalog sync" })
  @ApiOkResponse({ description: "Current catalog sync status" })
  pauseCatalogSync() {
    return this.catalogSyncService.pauseCatalogSync()
  }

  @Post("catalog/resume")
  @ApiOperation({ summary: "Resume paused catalog sync" })
  @ApiOkResponse({ description: "Current catalog sync status" })
  resumeCatalogSync() {
    return this.catalogSyncService.resumeCatalogSync()
  }

  @Post("catalog/stop")
  @ApiOperation({ summary: "Stop current catalog sync" })
  @ApiOkResponse({ description: "Current catalog sync status" })
  stopCatalogSync() {
    return this.catalogSyncService.stopCatalogSync()
  }

  @Get("catalog/status")
  @ApiOperation({ summary: "Get catalog sync status" })
  @ApiOkResponse({ description: "Current catalog sync status" })
  getCatalogSyncStatus() {
    return this.catalogSyncStatusService.getStatus()
  }
}

export { SyncController }
