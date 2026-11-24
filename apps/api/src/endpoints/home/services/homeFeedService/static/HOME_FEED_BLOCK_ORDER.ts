import { EHomeFeedBlockType } from "../types/EHomeFeedBlockType"

const HOME_FEED_BLOCK_ORDER = [3, 6, 6].flatMap((collectionCount) => [
  EHomeFeedBlockType.FACT,
  ...Array<EHomeFeedBlockType>(collectionCount).fill(
    EHomeFeedBlockType.COLLECTION,
  ),
])

export { HOME_FEED_BLOCK_ORDER }
