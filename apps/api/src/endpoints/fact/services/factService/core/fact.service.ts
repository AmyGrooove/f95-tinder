import { Injectable, NotFoundException } from "@nestjs/common"
import type { Types } from "mongoose"

import { FactRepository } from "@entities/fact/services/factRepository"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { isNil } from "@shared/functions/checks/isNil"

import type { FactResponseDto } from "../dto/fact.response"

@Injectable()
class FactService {
  constructor(private readonly factRepository: FactRepository) {}

  async getById(id: Types.ObjectId): Promise<FactResponseDto> {
    const fact = await this.factRepository.read.findById(id.toHexString(), {
      _id: 1,
      text: 1,
      sourceUrl: 1,
    })

    if (isNil(fact)) {
      throw new NotFoundException(DICTIONARY.fact.notFound)
    }

    return {
      id: fact._id.toHexString(),
      text: {
        ru: fact.text.ru ?? null,
        en: fact.text.en ?? null,
      },
      sourceUrl: fact.sourceUrl ?? null,
    }
  }
}

export { FactService }
