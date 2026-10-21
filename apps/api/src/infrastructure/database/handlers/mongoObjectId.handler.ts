import { BadRequestException, Injectable } from "@nestjs/common"
import type { PipeTransform } from "@nestjs/common"
import { Types } from "mongoose"

import { DICTIONARY } from "@shared/static/DICTIONARY"

@Injectable()
class MongoObjectIdHandler implements PipeTransform<string, Types.ObjectId> {
  transform(value: string) {
    if (!/^[a-fA-F0-9]{24}$/.test(value)) {
      throw new BadRequestException(DICTIONARY.database.invalidObjectId)
    }

    return new Types.ObjectId(value)
  }
}

export { MongoObjectIdHandler }
