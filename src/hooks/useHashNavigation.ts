import { useCallback, useEffect, useState } from "react";
import type { SettingsTab } from "../components/SettingsPage";
import {
  buildHashForPage,
  readPageFromHash,
  readSettingsTabFromHash,
  type PageType,
} from "../app/routing";

const useHashNavigation = () => {
  const [pageType, setPageType] = useState<PageType>(() => readPageFromHash());
  const [requestedSettingsTab, setRequestedSettingsTab] =
    useState<SettingsTab | null>(() => readSettingsTabFromHash());

  const setPage = useCallback(
    (nextPageType: PageType, nextSettingsTab: SettingsTab | null = null) => {
      setPageType((previousPageType) =>
        previousPageType === nextPageType ? previousPageType : nextPageType,
      );
      setRequestedSettingsTab((previousTab) => {
        const resolvedTab = nextPageType === "settings" ? nextSettingsTab : null;
        return previousTab === resolvedTab ? previousTab : resolvedTab;
      });

      const nextHash = buildHashForPage(nextPageType, nextSettingsTab);
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    },
    [],
  );

  useEffect(() => {
    const handleHashChange = () => {
      const nextPageType = readPageFromHash();
      const nextSettingsTab = readSettingsTabFromHash();

      setPageType((previousPageType) =>
        previousPageType === nextPageType ? previousPageType : nextPageType,
      );
      setRequestedSettingsTab((previousTab) =>
        previousTab === nextSettingsTab ? previousTab : nextSettingsTab,
      );
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return {
    pageType,
    requestedSettingsTab,
    setPage,
  };
};

export { useHashNavigation };
