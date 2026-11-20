import { randomInt } from "node:crypto"
import { Injectable } from "@nestjs/common"

import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { FactRepository } from "@entities/fact/services/factRepository"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { isNil } from "@shared/functions/checks/isNil"

import { HOME_FEED_SCHEDULE } from "../../../static/HOME_FEED_SCHEDULE"
import type { HomeFeedResponseDto } from "../dto/homeFeed.response"
import { HOME_FEED_BLOCK_ORDER } from "../static/HOME_FEED_BLOCK_ORDER"
import { HOME_FEED_FEATURE_IDS } from "../static/HOME_FEED_FEATURE_IDS"
import { EHomeFeedBlockType } from "../types/EHomeFeedBlockType"
import type { IHomeFeedBlock } from "../types/IHomeFeedBlock"

const { FACT, COLLECTION, FEATURE } = EHomeFeedBlockType

@Injectable()
class HomeFeedService {
  private readonly dateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: HOME_FEED_SCHEDULE.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  })

  constructor(
    private readonly cacheService: CacheService,
    private readonly factRepository: FactRepository,
    private readonly collectionRepository: CollectionRepository,
  ) {}

  async getFeed(): Promise<HomeFeedResponseDto> {
    const date = this.getFeedDate()
    const key = `home:feed:v1:${date}`
    const existing = await this.cacheService.get<IHomeFeedBlock[]>(key)
    const blocks = isNil(existing)
      ? await this.cacheService.setIfAbsent(
          key,
          await this.selectBlocks(),
          HOME_FEED_SCHEDULE.ttl,
        )
      : existing

    return { date, blocks }
  }

  private getFeedDate() {
    const { year, month, day, hour } = Object.fromEntries(
      this.dateFormatter
        .formatToParts(new Date())
        .map(({ type, value }) => [type, value]),
    )
    const date = `${year}-${month}-${day}`

    if (Number(hour) >= HOME_FEED_SCHEDULE.hour) {
      return date
    }

    const previousDate = new Date(`${date}T00:00:00.000Z`)
    previousDate.setUTCDate(previousDate.getUTCDate() - 1)

    return previousDate.toISOString().slice(0, 10)
  }

  private async selectBlocks(): Promise<IHomeFeedBlock[]> {
    const [facts, collections] = await Promise.all([
      this.factRepository.sampleIds(
        HOME_FEED_BLOCK_ORDER.filter((type) => type === FACT).length,
      ),
      this.collectionRepository.sampleAvailableSiteCollectionIds(
        HOME_FEED_BLOCK_ORDER.filter((type) => type === COLLECTION).length,
      ),
    ])
    const pools = {
      [FACT]: [...new Set(facts.map(({ _id }) => _id.toHexString()))],
      [COLLECTION]: [
        ...new Set(collections.map(({ _id }) => _id.toHexString())),
      ],
      [FEATURE]: [...new Set(HOME_FEED_FEATURE_IDS)],
    }

    const blocks: IHomeFeedBlock[] = []
    for (const type of HOME_FEED_BLOCK_ORDER) {
      const candidates = pools[type]
      if (candidates.length > 0) {
        const [id] = candidates.splice(randomInt(candidates.length), 1)
        blocks.push({ type, id })
      }
    }

    return blocks
  }
}

export { HomeFeedService }
