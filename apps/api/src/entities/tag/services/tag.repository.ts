import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import { Tag, type TagDocument } from "../schemas/tag.schema"
import type { TCreateTagPayload } from "../types/TCreateTagPayload"

@Injectable()
class TagRepository {
  constructor(
    @InjectModel(Tag.name) private readonly tagModel: Model<TagDocument>,
  ) {}

  countAll(): Promise<number> {
    return this.tagModel.countDocuments().exec()
  }

  upsertByF95TagId(payload: TCreateTagPayload): Promise<TagDocument | null> {
    return this.tagModel
      .findOneAndUpdate({ f95TagId: payload.f95TagId }, payload, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
      .exec()
  }

  findAll(): Promise<TagDocument[]> {
    return this.tagModel.find().sort({ name: 1 }).exec()
  }
}

export { TagRepository }
