import {
  Controller,
  Get,
  type MessageEvent,
  Sse,
} from '@nestjs/common';
import type { CatalogSyncStatus } from '@f95/contracts';
import type { Observable } from 'rxjs';

import { CatalogSyncProgressService } from '../services/catalogSyncProgress.service';

@Controller('catalog/sync')
export class CatalogSyncController {
  constructor(
    private readonly progressService: CatalogSyncProgressService,
  ) {}

  @Get('status')
  getStatus(): Promise<CatalogSyncStatus> {
    return this.progressService.getStatus();
  }

  @Sse('events')
  getEvents(): Observable<MessageEvent> {
    return this.progressService.stream();
  }
}
