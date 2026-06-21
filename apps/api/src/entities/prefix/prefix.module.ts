import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Prefix, PrefixSchema } from './schemas/prefix.schema';
import { PrefixRepository } from './services/prefix.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Prefix.name, schema: PrefixSchema }]),
  ],
  providers: [PrefixRepository],
  exports: [PrefixRepository],
})
export class PrefixModule {}
