import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Prefix } from '../schemas/prefix.schema';

type PrefixResource = {
  prefixes?: Record<string, unknown>;
  engines?: Record<string, unknown>;
};

@Injectable()
export class PrefixRepository implements OnModuleInit {
  constructor(
    @InjectModel(Prefix.name)
    private readonly prefixModel: Model<Prefix>,
  ) {}

  async onModuleInit(): Promise<void> {
    const content = await readFile(
      join(process.cwd(), 'resources', 'prefixes.json'),
      'utf8',
    );
    const resource = JSON.parse(content) as PrefixResource;
    const lookup = {
      ...(resource.prefixes ?? {}),
      ...(resource.engines ?? {}),
    };
    const prefixes = Object.entries(lookup)
      .map(([id, name]) => ({ f95PrefixId: Number(id), name }))
      .filter(
        (prefix): prefix is { f95PrefixId: number; name: string } =>
          Number.isInteger(prefix.f95PrefixId) &&
          typeof prefix.name === 'string',
      );

    await this.seed(prefixes);
  }

  async seed(
    prefixes: Array<{ f95PrefixId: number; name: string }>,
  ): Promise<void> {
    if (prefixes.length === 0) {
      return;
    }

    await this.prefixModel.bulkWrite(
      prefixes.map((prefix) => ({
        updateOne: {
          filter: { f95PrefixId: prefix.f95PrefixId },
          update: { $set: { name: prefix.name } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
}
