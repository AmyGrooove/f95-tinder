import { EHomeFeedBlockType } from "../types/EHomeFeedBlockType"

const HOME_FEED_BLOCK_ORDER = [
  EHomeFeedBlockType.FACT,
  EHomeFeedBlockType.FEATURE,
  EHomeFeedBlockType.FACT,
  EHomeFeedBlockType.FEATURE,
  EHomeFeedBlockType.FACT,
].flatMap((type) => [
  type,
  EHomeFeedBlockType.COLLECTION,
  EHomeFeedBlockType.COLLECTION,
  EHomeFeedBlockType.COLLECTION,
])

export { HOME_FEED_BLOCK_ORDER }
