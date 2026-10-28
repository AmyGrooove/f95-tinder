import { EItemField } from "@entities/item/schemas/EItemField"

const SEARCH_ITEM_FIELDS = {
  [EItemField.RELEASE_DATE]: "releaseDate",
  [EItemField.AGE_RESTRICTION]: "ageRestriction",
  [EItemField.DURATION]: "duration",
  [EItemField.EPISODE_COUNT]: "episodeCount",
  [EItemField.RELEASED_EPISODE_COUNT]: "releasedEpisodeCount",
  [EItemField.EPISODE_DURATION]: "episodeDuration",
  [EItemField.NEXT_EPISODE_AT]: "nextEpisodeAt",
  [EItemField.MAIN_STORY_DURATION]: "mainStoryDuration",
  [EItemField.FULL_COMPLETION_DURATION]: "fullCompletionDuration",
} as const

export { SEARCH_ITEM_FIELDS }
