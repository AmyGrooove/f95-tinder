import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  clearAllStoredData,
  loadDashboardViewState,
  normalizeDefaultSwipeSettings,
  normalizePrefixesMap,
  normalizeTagsMap,
  saveDefaultSwipeSettings,
  saveDashboardViewState,
  savePrefixesMap,
  saveSessionState,
  saveTagsMap,
} from "../f95/storage";
import {
  clearCookieProxyInput,
  fetchCookieProxyBackup,
  saveCookieProxyInput,
} from "../f95/cookieProxy";
import {
  clearAllCachedThreadDownloads,
  clearDisabledDownloadHosts,
  clearHiddenDownloadHosts,
  resetPreferredDownloadHosts,
  saveDisabledDownloadHosts,
  saveHiddenDownloadHosts,
  savePreferredDownloadHosts,
} from "../f95/downloads";
import { downloadJsonFile, readFileAsText, safeJsonParse } from "../f95/utils";
import { openLauncherLocalDataFolder } from "../launcher/runtime";
import {
  getLauncherLocalDataSnapshotSync,
  loadBundledPrefixesMapViaLauncher,
  loadBundledTagsMapViaLauncher,
} from "../launcher/runtime";
import { restartApplicationWindow } from "../app/linking";
import { serializeDefaultSwipeSettings } from "../app/defaultSwipeSettings";
import {
  extractLocalAllBackup,
  extractLocalListsBackup,
  extractLocalSettingsBackup,
  LOCAL_BACKUP_FORMAT,
  type LocalBackupFile,
  type LocalListsBackup,
  type LocalSettingsBackup,
} from "../app/backups";
import type {
  DefaultSwipeSettings,
  FilterState,
  LatestGamesSort,
  SessionState,
} from "../f95/types";

type UseAppDataActionsOptions = {
  sessionState: SessionState;
  defaultFilterState: FilterState;
  defaultLatestGamesSort: LatestGamesSort;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
  preferredDownloadHosts: string[];
  disabledDownloadHosts: Record<string, number>;
  hiddenDownloadHosts: string[];
  replaceDefaultSwipeSettings: (settings: DefaultSwipeSettings) => void;
  updateTagsMap: (nextMap: Record<string, string>) => void;
  updatePrefixesMap: (nextMap: Record<string, string>) => void;
  clearDashboardLists: () => void;
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
};

type BundledDefaultFiltersStatus =
  | "checking"
  | "loaded"
  | "not_loaded"
  | "unavailable";

const useAppDataActions = ({
  sessionState,
  defaultFilterState,
  defaultLatestGamesSort,
  tagsMap,
  prefixesMap,
  preferredDownloadHosts,
  disabledDownloadHosts,
  hiddenDownloadHosts,
  replaceDefaultSwipeSettings,
  updateTagsMap,
  updatePrefixesMap,
  clearDashboardLists,
  setErrorMessage,
}: UseAppDataActionsOptions) => {
  const importAllBackupInputRef = useRef<HTMLInputElement | null>(null);
  const importSettingsBackupInputRef = useRef<HTMLInputElement | null>(null);
  const importListsBackupInputRef = useRef<HTMLInputElement | null>(null);
  const importTagsMapInputRef = useRef<HTMLInputElement | null>(null);
  const importPrefixesMapInputRef = useRef<HTMLInputElement | null>(null);
  const hasAttemptedBundledTagsBootstrapRef = useRef(false);
  const hasAttemptedBundledPrefixesBootstrapRef = useRef(false);

  const launcherLocalDataSnapshot = useMemo(
    () => getLauncherLocalDataSnapshotSync(),
    [],
  );
  const localDataFiles = useMemo(() => {
    if (!launcherLocalDataSnapshot) {
      return null;
    }

    return {
      listsPath:
        launcherLocalDataSnapshot.listsFile.path || "Файл списков не найден",
      settingsPath:
        launcherLocalDataSnapshot.settingsFile.path ||
        "Файл настроек не найден",
      catalogPath:
        launcherLocalDataSnapshot.catalogFile.path ||
        "Файл каталога latest не найден",
      catalogCheckpointPath:
        launcherLocalDataSnapshot.catalogCheckpointFile.path ||
        "Файл checkpoint каталога latest не найден",
    };
  }, [launcherLocalDataSnapshot]);

  const [bundledDefaultSwipeSettings, setBundledDefaultSwipeSettings] =
    useState<DefaultSwipeSettings | null>(null);
  const [isBundledDefaultSwipeSettingsChecking, setIsBundledDefaultSwipeSettingsChecking] =
    useState(true);

  const createListsBackup = useCallback(
    (): LocalListsBackup => ({
      sessionState,
      tagsMap,
      prefixesMap,
    }),
    [prefixesMap, sessionState, tagsMap],
  );

  const createSettingsBackup = useCallback(async (): Promise<LocalSettingsBackup> => {
    return {
      defaultSwipeSettings: normalizeDefaultSwipeSettings({
        latestGamesSort: defaultLatestGamesSort,
        filterState: defaultFilterState,
      }),
      dashboardViewState: loadDashboardViewState(),
      tagsMap,
      prefixesMap,
      preferredDownloadHosts,
      disabledDownloadHosts,
      hiddenDownloadHosts,
      cookieProxy: await fetchCookieProxyBackup(),
    };
  }, [
    defaultFilterState,
    defaultLatestGamesSort,
    disabledDownloadHosts,
    hiddenDownloadHosts,
    prefixesMap,
    preferredDownloadHosts,
    tagsMap,
  ]);

  const applyImportedListsBackup = useCallback((backup: LocalListsBackup) => {
    saveSessionState(backup.sessionState);
    saveTagsMap(backup.tagsMap);
    savePrefixesMap(backup.prefixesMap);
  }, []);

  const applyImportedSettingsBackup = useCallback(
    async (backup: LocalSettingsBackup) => {
      if (backup.cookieProxy) {
        if (backup.cookieProxy.source === "settings" && backup.cookieProxy.text) {
          await saveCookieProxyInput(backup.cookieProxy.text);
        } else if (backup.cookieProxy.source === "settings") {
          throw new Error(
            "Импорт настроек: cookieProxy.source=settings, но текст кук отсутствует",
          );
        } else {
          await clearCookieProxyInput();
        }
      }

      saveDefaultSwipeSettings(backup.defaultSwipeSettings);
      saveDashboardViewState(backup.dashboardViewState);
      saveTagsMap(backup.tagsMap);
      savePrefixesMap(backup.prefixesMap);
      savePreferredDownloadHosts(backup.preferredDownloadHosts);
      saveDisabledDownloadHosts(backup.disabledDownloadHosts);
      saveHiddenDownloadHosts(backup.hiddenDownloadHosts);
    },
    [],
  );

  const handleExportAllBackup = useCallback(async () => {
    try {
      setErrorMessage(null);
      const payload: LocalBackupFile = {
        format: LOCAL_BACKUP_FORMAT,
        exportType: "all",
        exportedAtUnixMs: Date.now(),
        lists: createListsBackup(),
        settings: await createSettingsBackup(),
      };
      downloadJsonFile("f95-tinder-all.json", payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка экспорта локальных данных",
      );
    }
  }, [createListsBackup, createSettingsBackup, setErrorMessage]);

  const handleExportSettingsBackup = useCallback(async () => {
    try {
      setErrorMessage(null);
      const payload: LocalBackupFile = {
        format: LOCAL_BACKUP_FORMAT,
        exportType: "settings",
        exportedAtUnixMs: Date.now(),
        settings: await createSettingsBackup(),
      };
      downloadJsonFile("f95-tinder-settings.json", payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка экспорта настроек",
      );
    }
  }, [createSettingsBackup, setErrorMessage]);

  const handleExportListsBackup = useCallback(() => {
    setErrorMessage(null);
    const payload: LocalBackupFile = {
      format: LOCAL_BACKUP_FORMAT,
      exportType: "lists",
      exportedAtUnixMs: Date.now(),
      lists: createListsBackup(),
    };
    downloadJsonFile("f95-tinder-lists.json", payload);
  }, [createListsBackup, setErrorMessage]);

  const handleImportAllBackupChange = useCallback(async () => {
    const inputElement = importAllBackupInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);
      const backup = extractLocalAllBackup(parsedJson);

      await applyImportedSettingsBackup(backup.settings);
      applyImportedListsBackup(backup.lists);
      await restartApplicationWindow();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта локальных данных",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [applyImportedListsBackup, applyImportedSettingsBackup, setErrorMessage]);

  const handleImportSettingsBackupChange = useCallback(async () => {
    const inputElement = importSettingsBackupInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);
      const backup = extractLocalSettingsBackup(parsedJson);

      await applyImportedSettingsBackup(backup);
      await restartApplicationWindow();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта настроек",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [applyImportedSettingsBackup, setErrorMessage]);

  const handleImportListsBackupChange = useCallback(async () => {
    const inputElement = importListsBackupInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);
      const backup = extractLocalListsBackup(parsedJson);

      applyImportedListsBackup(backup);
      await restartApplicationWindow();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта списков",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [applyImportedListsBackup, setErrorMessage]);

  const handleImportTagsMapChange = useCallback(async () => {
    const inputElement = importTagsMapInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);

      if (
        !parsedJson ||
        typeof parsedJson !== "object" ||
        Array.isArray(parsedJson)
      ) {
        throw new Error("Импорт: ожидается объект тегов");
      }

      updateTagsMap(normalizeTagsMap(parsedJson));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта тегов",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [setErrorMessage, updateTagsMap]);

  const handleImportPrefixesMapChange = useCallback(async () => {
    const inputElement = importPrefixesMapInputRef.current;
    const file = inputElement?.files?.[0];
    if (!file) {
      return;
    }

    try {
      setErrorMessage(null);
      const fileText = await readFileAsText(file);
      const parsedJson = safeJsonParse<unknown>(fileText);

      if (
        !parsedJson ||
        typeof parsedJson !== "object" ||
        Array.isArray(parsedJson)
      ) {
        throw new Error("Импорт: ожидается объект префиксов");
      }

      updatePrefixesMap(normalizePrefixesMap(parsedJson));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Ошибка импорта префиксов",
      );
    } finally {
      if (inputElement) {
        inputElement.value = "";
      }
    }
  }, [setErrorMessage, updatePrefixesMap]);

  const loadBundledTagsMap = useCallback(async () => {
    const launcherTagsMap = await loadBundledTagsMapViaLauncher();
    const parsedJson = launcherTagsMap
      ? (launcherTagsMap as unknown)
      : ((await (async () => {
          const response = await fetch("/tags.json", {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(
              `Не удалось загрузить встроенные теги: ${response.status}`,
            );
          }

          return response.json();
        })()) as unknown);
    const normalizedTagsMap = normalizeTagsMap(parsedJson);

    if (Object.keys(normalizedTagsMap).length === 0) {
      throw new Error("Встроенный tags.json пустой или имеет неверный формат");
    }

    return normalizedTagsMap;
  }, []);

  const loadBundledPrefixesMap = useCallback(async () => {
    const launcherPrefixesMap = await loadBundledPrefixesMapViaLauncher();
    const parsedJson = launcherPrefixesMap
      ? (launcherPrefixesMap as unknown)
      : ((await (async () => {
          const response = await fetch("/prefixes.json", {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(
              `Не удалось загрузить встроенные префиксы: ${response.status}`,
            );
          }

          return response.json();
        })()) as unknown);
    const normalizedPrefixesMap = normalizePrefixesMap(parsedJson);

    if (Object.keys(normalizedPrefixesMap).length === 0) {
      throw new Error(
        "Встроенный prefixes.json пустой или имеет неверный формат",
      );
    }

    return normalizedPrefixesMap;
  }, []);

  const loadBundledDefaultSwipeSettings = useCallback(async () => {
    const response = await fetch("/default-filters.json", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Не удалось загрузить встроенные дефолтные фильтры: ${response.status}`,
      );
    }

    const parsedJson = (await response.json()) as unknown;

    if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
      throw new Error(
        "Встроенный default-filters.json пустой или имеет неверный формат",
      );
    }

    return normalizeDefaultSwipeSettings(parsedJson);
  }, []);

  const handleImportBundledTagsMap = useCallback(async () => {
    try {
      setErrorMessage(null);
      updateTagsMap(await loadBundledTagsMap());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки встроенных тегов",
      );
    }
  }, [loadBundledTagsMap, setErrorMessage, updateTagsMap]);

  const handleImportBundledPrefixesMap = useCallback(async () => {
    try {
      setErrorMessage(null);
      updatePrefixesMap(await loadBundledPrefixesMap());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки встроенных префиксов",
      );
    }
  }, [loadBundledPrefixesMap, setErrorMessage, updatePrefixesMap]);

  const handleImportBundledDefaultFilterState = useCallback(async () => {
    try {
      setErrorMessage(null);
      replaceDefaultSwipeSettings(await loadBundledDefaultSwipeSettings());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ошибка загрузки встроенных дефолтных фильтров",
      );
    }
  }, [
    loadBundledDefaultSwipeSettings,
    replaceDefaultSwipeSettings,
    setErrorMessage,
  ]);

  useEffect(() => {
    let isCancelled = false;

    setIsBundledDefaultSwipeSettingsChecking(true);

    void (async () => {
      try {
        const nextBundledDefaultSwipeSettings =
          await loadBundledDefaultSwipeSettings();
        if (!isCancelled) {
          setBundledDefaultSwipeSettings(nextBundledDefaultSwipeSettings);
        }
      } catch {
        if (!isCancelled) {
          setBundledDefaultSwipeSettings(null);
        }
      } finally {
        if (!isCancelled) {
          setIsBundledDefaultSwipeSettingsChecking(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [loadBundledDefaultSwipeSettings]);

  useEffect(() => {
    if (Object.keys(tagsMap).length > 0) {
      hasAttemptedBundledTagsBootstrapRef.current = false;
      return;
    }

    if (hasAttemptedBundledTagsBootstrapRef.current) {
      return;
    }

    hasAttemptedBundledTagsBootstrapRef.current = true;

    void (async () => {
      try {
        updateTagsMap(await loadBundledTagsMap());
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Ошибка загрузки встроенных тегов";
        setErrorMessage((previousState) => previousState ?? message);
      }
    })();
  }, [loadBundledTagsMap, setErrorMessage, tagsMap, updateTagsMap]);

  useEffect(() => {
    if (hasAttemptedBundledPrefixesBootstrapRef.current) {
      return;
    }

    hasAttemptedBundledPrefixesBootstrapRef.current = true;

    void (async () => {
      try {
        const bundledPrefixesMap = await loadBundledPrefixesMap();
        const mergedPrefixesMap = {
          ...bundledPrefixesMap,
          ...prefixesMap,
        };
        const hasMissingBundledPrefixLabels = Object.keys(bundledPrefixesMap).some(
          (prefixId) => {
            const currentLabel = prefixesMap[prefixId];
            return (
              typeof currentLabel !== "string" || currentLabel.trim().length === 0
            );
          },
        );

        if (hasMissingBundledPrefixLabels) {
          updatePrefixesMap(mergedPrefixesMap);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Ошибка загрузки встроенных префиксов";
        setErrorMessage((previousState) => previousState ?? message);
      }
    })();
  }, [
    loadBundledPrefixesMap,
    prefixesMap,
    setErrorMessage,
    updatePrefixesMap,
  ]);

  const currentDefaultSwipeSettings = useMemo(
    () =>
      normalizeDefaultSwipeSettings({
        latestGamesSort: defaultLatestGamesSort,
        filterState: defaultFilterState,
      }),
    [defaultFilterState, defaultLatestGamesSort],
  );

  const bundledDefaultFiltersStatus = useMemo<BundledDefaultFiltersStatus>(() => {
    if (isBundledDefaultSwipeSettingsChecking) {
      return "checking";
    }

    if (!bundledDefaultSwipeSettings) {
      return "unavailable";
    }

    return serializeDefaultSwipeSettings(currentDefaultSwipeSettings) ===
      serializeDefaultSwipeSettings(bundledDefaultSwipeSettings)
      ? "loaded"
      : "not_loaded";
  }, [
    bundledDefaultSwipeSettings,
    currentDefaultSwipeSettings,
    isBundledDefaultSwipeSettingsChecking,
  ]);

  const handleOpenLocalDataFiles = useCallback(() => {
    void openLauncherLocalDataFolder().catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось открыть папку локальных файлов",
      );
    });
  }, [setErrorMessage]);

  const handleConfirmClearDashboardLists = useCallback(() => {
    const shouldClear = window.confirm(
      "Очистить списки? Это удалит Закладки, Мусор и Играл.",
    );
    if (shouldClear) {
      clearDashboardLists();
    }
  }, [clearDashboardLists]);

  const handleConfirmResetLocalSettings = useCallback(() => {
    const shouldReset = window.confirm(
      "Сбросить локальные настройки? Это вернет дефолтные фильтры, очистит tags/prefixes map и локально сохраненные куки proxy.",
    );
    if (!shouldReset) {
      return;
    }

    void (async () => {
      try {
        setErrorMessage(null);
        saveDefaultSwipeSettings(undefined);
        saveDashboardViewState(undefined);
        saveTagsMap({});
        savePrefixesMap({});
        resetPreferredDownloadHosts();
        clearDisabledDownloadHosts();
        clearHiddenDownloadHosts();
        await clearCookieProxyInput();
        await restartApplicationWindow();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Не удалось сбросить настройки",
        );
      }
    })();
  }, [setErrorMessage]);

  const handleConfirmClearAllLocalData = useCallback(() => {
    const shouldClear = window.confirm(
      "Очистить все локальные данные? Это удалит списки, фильтры, карты tags/prefixes, локальные куки proxy и кэш.",
    );
    if (!shouldClear) {
      return;
    }

    void (async () => {
      try {
        setErrorMessage(null);
        clearAllStoredData();
        clearAllCachedThreadDownloads();
        resetPreferredDownloadHosts();
        clearDisabledDownloadHosts();
        clearHiddenDownloadHosts();
        await clearCookieProxyInput();
        await restartApplicationWindow();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не удалось очистить локальные данные",
        );
      }
    })();
  }, [setErrorMessage]);

  return {
    bundledDefaultFiltersStatus,
    handleConfirmClearAllLocalData,
    handleConfirmClearDashboardLists,
    handleConfirmResetLocalSettings,
    handleExportAllBackup,
    handleExportListsBackup,
    handleExportSettingsBackup,
    handleImportAllBackupChange,
    handleImportBundledDefaultFilterState,
    handleImportBundledPrefixesMap,
    handleImportBundledTagsMap,
    handleImportListsBackupChange,
    handleImportPrefixesMapChange,
    handleImportSettingsBackupChange,
    handleImportTagsMapChange,
    handleOpenLocalDataFiles,
    importAllBackupInputRef,
    importListsBackupInputRef,
    importPrefixesMapInputRef,
    importSettingsBackupInputRef,
    importTagsMapInputRef,
    localDataFiles,
  };
};

export { useAppDataActions };
