import type { F95ThreadItem, FilterState } from "./types";

const MAX_TAG_FILTERS_PER_GROUP = 10;

const DEFAULT_FILTER_STATE: FilterState = {
  searchText: "",
  minimumRating: 0,
  onlyNew: false,
  hideWatched: false,
  hideIgnored: false,
  includeTagIds: [],
  excludeTagIds: [],
  includePrefixIds: [],
  excludePrefixIds: [],
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const normalizeIdList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: number[] = [];
  const seenTagIds = new Set<number>();

  for (const item of value) {
    const parsedValue =
      typeof item === "number"
        ? item
        : typeof item === "string"
          ? Number(item)
          : Number.NaN;

    if (!Number.isInteger(parsedValue) || seenTagIds.has(parsedValue)) {
      continue;
    }

    seenTagIds.add(parsedValue);
    normalized.push(parsedValue);
  }

  return normalized;
};

const normalizeFilterState = (value: unknown): FilterState => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_FILTER_STATE };
  }

  const rawValue = value as Partial<FilterState>;
  const includeTagIds = normalizeIdList(rawValue.includeTagIds).slice(
    0,
    MAX_TAG_FILTERS_PER_GROUP,
  );
  const excludeTagIds = normalizeIdList(rawValue.excludeTagIds).filter(
    (tagId) => !includeTagIds.includes(tagId),
  ).slice(0, MAX_TAG_FILTERS_PER_GROUP);
  const includePrefixIds = normalizeIdList(rawValue.includePrefixIds);
  const excludePrefixIds = normalizeIdList(rawValue.excludePrefixIds).filter(
    (prefixId) => !includePrefixIds.includes(prefixId),
  );

  return {
    searchText:
      typeof rawValue.searchText === "string"
        ? rawValue.searchText
        : DEFAULT_FILTER_STATE.searchText,
    minimumRating:
      typeof rawValue.minimumRating === "number" &&
      Number.isFinite(rawValue.minimumRating)
        ? rawValue.minimumRating
        : DEFAULT_FILTER_STATE.minimumRating,
    onlyNew:
      typeof rawValue.onlyNew === "boolean"
        ? rawValue.onlyNew
        : DEFAULT_FILTER_STATE.onlyNew,
    hideWatched:
      typeof rawValue.hideWatched === "boolean"
        ? rawValue.hideWatched
        : DEFAULT_FILTER_STATE.hideWatched,
    hideIgnored:
      typeof rawValue.hideIgnored === "boolean"
        ? rawValue.hideIgnored
        : DEFAULT_FILTER_STATE.hideIgnored,
    includeTagIds,
    excludeTagIds,
    includePrefixIds,
    excludePrefixIds,
  };
};

const threadMatchesFilter = (
  threadItem: F95ThreadItem,
  filterState: FilterState,
) => {
  const searchText = normalizeText(filterState.searchText);

  const matchesSearchText =
    searchText.length === 0 ||
    normalizeText(threadItem.title).includes(searchText) ||
    normalizeText(threadItem.creator).includes(searchText);

  const threadTagIds = Array.isArray(threadItem.tags)
    ? threadItem.tags.filter((tagId) => typeof tagId === "number")
    : [];
  const threadPrefixIds = Array.isArray(threadItem.prefixes)
    ? threadItem.prefixes.filter((prefixId) => typeof prefixId === "number")
    : [];
  const matchesIncludedTags =
    filterState.includeTagIds.length === 0 ||
    filterState.includeTagIds.every((tagId) => threadTagIds.includes(tagId));
  const matchesExcludedTags =
    filterState.excludeTagIds.length === 0 ||
    filterState.excludeTagIds.every((tagId) => !threadTagIds.includes(tagId));
  const matchesIncludedPrefixes =
    filterState.includePrefixIds.length === 0 ||
    filterState.includePrefixIds.every((prefixId) =>
      threadPrefixIds.includes(prefixId),
    );
  const matchesExcludedPrefixes =
    filterState.excludePrefixIds.length === 0 ||
    filterState.excludePrefixIds.every(
      (prefixId) => !threadPrefixIds.includes(prefixId),
    );

  return (
    matchesSearchText &&
    matchesIncludedTags &&
    matchesExcludedTags &&
    matchesIncludedPrefixes &&
    matchesExcludedPrefixes
  );
};

export {
  DEFAULT_FILTER_STATE,
  MAX_TAG_FILTERS_PER_GROUP,
  normalizeFilterState,
  normalizeIdList,
  normalizeText,
  threadMatchesFilter,
};
