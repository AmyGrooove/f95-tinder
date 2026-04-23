import type { ProcessedThreadItem } from "../f95/types";

const parseThreadIdentifierFromLink = (threadLink: string) => {
  const match = /\/threads\/(\d+)/.exec(threadLink);
  if (!match) {
    return null;
  }
  return Number(match[1]);
};

const pickCoverForLink = (
  threadLink: string,
  processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
  threadItemsByIdentifier: Record<string, { cover?: string }>,
) => {
  const processedItem = processedThreadItemsByLink[threadLink];
  if (processedItem?.cover) {
    return processedItem.cover;
  }

  const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
  if (threadIdentifier === null) {
    return "";
  }

  const threadItem = threadItemsByIdentifier[String(threadIdentifier)];
  return typeof threadItem?.cover === "string" ? threadItem.cover : "";
};

const pickTitleForLink = (
  threadLink: string,
  processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
  threadItemsByIdentifier: Record<string, { title?: string }>,
) => {
  const processedItem = processedThreadItemsByLink[threadLink];
  if (processedItem?.title) {
    return processedItem.title;
  }

  const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
  if (threadIdentifier === null) {
    return threadLink;
  }

  const threadItem = threadItemsByIdentifier[String(threadIdentifier)];
  return typeof threadItem?.title === "string"
    ? threadItem.title
    : `Thread ${threadIdentifier}`;
};

const pickCreatorForLink = (
  threadLink: string,
  processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
  threadItemsByIdentifier: Record<string, { creator?: string }>,
) => {
  const processedItem = processedThreadItemsByLink[threadLink];
  if (processedItem?.creator) {
    return processedItem.creator;
  }

  const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
  if (threadIdentifier === null) {
    return "Unknown";
  }

  const threadItem = threadItemsByIdentifier[String(threadIdentifier)];
  return typeof threadItem?.creator === "string"
    ? threadItem.creator
    : "Unknown";
};

const pickRatingForLink = (
  threadLink: string,
  processedThreadItemsByLink: Record<string, ProcessedThreadItem>,
  threadItemsByIdentifier: Record<string, { rating?: number }>,
) => {
  const processedItem = processedThreadItemsByLink[threadLink];
  if (typeof processedItem?.rating === "number") {
    return processedItem.rating;
  }

  const threadIdentifier = parseThreadIdentifierFromLink(threadLink);
  if (threadIdentifier === null) {
    return 0;
  }

  const threadItem = threadItemsByIdentifier[String(threadIdentifier)];
  return typeof threadItem?.rating === "number" ? threadItem.rating : 0;
};

export {
  parseThreadIdentifierFromLink,
  pickCoverForLink,
  pickCreatorForLink,
  pickRatingForLink,
  pickTitleForLink,
};
