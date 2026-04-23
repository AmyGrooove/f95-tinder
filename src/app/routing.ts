import type { SettingsTab } from "../components/SettingsPage";

type PageType = "swipe" | "lists" | "dashboard" | "settings";

const readHashRoute = () => {
  const rawHashValue = window.location.hash.replace("#", "").trim().toLowerCase();
  const [pageValue, queryValue = ""] = rawHashValue.split("?");

  return {
    pageValue,
    searchParams: new URLSearchParams(queryValue),
  };
};

const readPageFromHash = (): PageType => {
  const { pageValue } = readHashRoute();
  if (pageValue === "lists") {
    return "lists";
  }
  if (pageValue === "dashboard") {
    return "dashboard";
  }
  if (pageValue === "settings") {
    return "settings";
  }
  return "swipe";
};

const isSettingsTab = (value: string | null): value is SettingsTab => {
  return (
    value === "cookies" ||
    value === "filters" ||
    value === "tags" ||
    value === "data"
  );
};

const readSettingsTabFromHash = (): SettingsTab | null => {
  const { pageValue, searchParams } = readHashRoute();
  if (pageValue !== "settings") {
    return null;
  }

  const requestedTab = searchParams.get("tab");
  return isSettingsTab(requestedTab) ? requestedTab : null;
};

const buildHashForPage = (
  nextPageType: PageType,
  nextSettingsTab: SettingsTab | null = null,
) => {
  if (nextPageType === "lists") {
    return "#lists";
  }

  if (nextPageType === "dashboard") {
    return "#dashboard";
  }

  if (nextPageType === "settings") {
    return nextSettingsTab ? `#settings?tab=${nextSettingsTab}` : "#settings";
  }

  return "#swipe";
};

export {
  buildHashForPage,
  isSettingsTab,
  readHashRoute,
  readPageFromHash,
  readSettingsTabFromHash,
};

export type { PageType };
