import { Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"

import { Prefix, type PrefixDocument } from "../schemas/prefix.schema"
import type { TCreatePrefixPayload } from "../types/TCreatePrefixPayload"

@Injectable()
class PrefixRepository {
  constructor(
    @InjectModel(Prefix.name)
    private readonly prefixModel: Model<PrefixDocument>,
  ) {}

  countAll(): Promise<number> {
    return this.prefixModel.countDocuments().exec()
  }

  upsertByF95PrefixId(
    payload: TCreatePrefixPayload,
  ): Promise<PrefixDocument | null> {
    return this.prefixModel
      .findOneAndUpdate({ f95PrefixId: payload.f95PrefixId }, payload, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      })
      .exec()
  }

  findAll(): Promise<PrefixDocument[]> {
    return this.prefixModel.find().sort({ group: 1, name: 1 }).exec()
  }
}

export { PrefixRepository }
