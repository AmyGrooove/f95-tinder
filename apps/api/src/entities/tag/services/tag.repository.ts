import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { Tag } from '../schemas/tag.schema';

@Injectable()
export class TagRepository implements OnModuleInit {
  constructor(
    @InjectModel(Tag.name)
    private readonly tagModel: Model<Tag>,
  ) {}

  async onModuleInit(): Promise<void> {
    const content = await readFile(
      join(process.cwd(), 'resources', 'tags.json'),
      'utf8',
    );
    const lookup = JSON.parse(content) as Record<string, unknown>;
    const tags = Object.entries(lookup)
      .map(([id, name]) => ({ f95TagId: Number(id), name }))
      .filter(
        (tag): tag is { f95TagId: number; name: string } =>
          Number.isInteger(tag.f95TagId) && typeof tag.name === 'string',
      );

    await this.seed(tags);
  }

  async seed(tags: Array<{ f95TagId: number; name: string }>): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    await this.tagModel.bulkWrite(
      tags.map((tag) => ({
        updateOne: {
          filter: { f95TagId: tag.f95TagId },
          update: { $set: { name: tag.name } },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
}
