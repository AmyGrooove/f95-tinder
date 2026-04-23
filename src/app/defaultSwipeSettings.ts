import type { DefaultSwipeSettings } from "../f95/types";

const serializeDefaultSwipeSettings = (settings: DefaultSwipeSettings) => {
  return JSON.stringify({
    latestGamesSort: settings.latestGamesSort,
    filterState: {
      searchText: settings.filterState.searchText,
      minimumRating: settings.filterState.minimumRating,
      onlyNew: settings.filterState.onlyNew,
      hideWatched: settings.filterState.hideWatched,
      hideIgnored: settings.filterState.hideIgnored,
      includeTagIds: [...settings.filterState.includeTagIds].sort((a, b) => a - b),
      excludeTagIds: [...settings.filterState.excludeTagIds].sort((a, b) => a - b),
      includePrefixIds: [...settings.filterState.includePrefixIds].sort(
        (a, b) => a - b,
      ),
      excludePrefixIds: [...settings.filterState.excludePrefixIds].sort(
        (a, b) => a - b,
      ),
    },
  });
};

export { serializeDefaultSwipeSettings };
