import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import { Creator, type CreatorDocument } from "../schemas/creator.schema"
import type { TCreateCreatorPayload } from "../types/TCreateCreatorPayload"

@Injectable()
class CreatorRepository {
  constructor(
    @InjectModel(Creator.name)
    private readonly creatorModel: Model<CreatorDocument>,
  ) {}

  countAll(): Promise<number> {
    return this.creatorModel.countDocuments().exec()
  }

  upsertBySlug(
    payload: TCreateCreatorPayload,
  ): Promise<CreatorDocument | null> {
    return this.creatorModel
      .findOneAndUpdate({ slug: payload.slug }, payload, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
      .exec()
  }

  findAll(): Promise<CreatorDocument[]> {
    return this.creatorModel.find().sort({ name: 1 }).exec()
  }

  findByNameSearch(search: string): Promise<CreatorDocument[]> {
    return this.creatorModel
      .find({ name: { $regex: search, $options: "i" } })
      .sort({ name: 1 })
      .exec()
  }
}

export { CreatorRepository }
