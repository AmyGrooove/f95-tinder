import { Injectable, OnModuleInit } from "@nestjs/common"
import type { Types } from "mongoose"

import type { TPrefixGroup } from "@entities/prefix/types/TPrefixGroup"
import { PrefixRepository } from "@entities/prefix/services/prefix.repository"
import { TagRepository } from "@entities/tag/services/tag.repository"

import { PUBLIC_PREFIXES_MAP } from "../static/PUBLIC_PREFIXES_MAP"
import { PUBLIC_TAGS_MAP } from "../static/PUBLIC_TAGS_MAP"

@Injectable()
class CatalogSeedService implements OnModuleInit {
  constructor(
    private readonly tagRepository: TagRepository,
    private readonly prefixRepository: PrefixRepository,
  ) {}

  async onModuleInit() {
    await this.ensureCatalogDictionaries()
  }

  async ensureCatalogDictionaries() {
    const tagCount = await this.tagRepository.countAll()
    const prefixCount = await this.prefixRepository.countAll()

    if (tagCount > 0 && prefixCount > 0) {
      return
    }

    await this.seedCatalogDictionaries()
  }

  async seedCatalogDictionaries() {
    const tagSeeds = Object.entries(PUBLIC_TAGS_MAP).map(
      ([f95TagIdText, tagName]) => {
        return {
          f95TagId: Number(f95TagIdText),
          name: tagName,
        }
      },
    )
    const prefixGroups = Object.keys(PUBLIC_PREFIXES_MAP) as TPrefixGroup[]
    const prefixSeeds = prefixGroups.flatMap((group) => {
      return Object.entries(PUBLIC_PREFIXES_MAP[group]).map(
        ([f95PrefixIdText, prefixName]) => {
          return {
            f95PrefixId: Number(f95PrefixIdText),
            name: prefixName,
            group,
          }
        },
      )
    })

    for (const tagSeed of tagSeeds) {
      await this.tagRepository.upsertByF95TagId({
        f95TagId: tagSeed.f95TagId,
        name: tagSeed.name,
        slug: this.createSlug(tagSeed.name),
      })
    }

    for (const prefixSeed of prefixSeeds) {
      await this.prefixRepository.upsertByF95PrefixId({
        f95PrefixId: prefixSeed.f95PrefixId,
        name: prefixSeed.name,
        group: prefixSeed.group,
        slug: this.createSlug(prefixSeed.name),
      })
    }
  }

  async getCatalogObjectIdMaps() {
    const tags = await this.tagRepository.findAll()
    const prefixes = await this.prefixRepository.findAll()
    const tagObjectIdByF95Id = new Map<number, Types.ObjectId>()
    const prefixObjectIdByF95Id = new Map<number, Types.ObjectId>()

    tags.forEach((tag) => {
      tagObjectIdByF95Id.set(tag.f95TagId, tag._id)
    })

    prefixes.forEach((prefix) => {
      prefixObjectIdByF95Id.set(prefix.f95PrefixId, prefix._id)
    })

    return {
      tagObjectIdByF95Id,
      prefixObjectIdByF95Id,
    }
  }

  private createSlug(name: string) {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }
}

export { CatalogSeedService }
