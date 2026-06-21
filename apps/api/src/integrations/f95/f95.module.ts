import { Module } from '@nestjs/common';

import { F95LatestClient } from './services/f95Latest.client';

@Module({
  providers: [F95LatestClient],
  exports: [F95LatestClient],
})
export class F95Module {}
