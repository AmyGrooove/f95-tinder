import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  clearCookieProxyInput,
  fetchCookieProxyStatus,
  saveCookieProxyInput,
  type CookieProxyStatus,
} from "../f95/cookieProxy";
import { MAX_TAG_FILTERS_PER_GROUP } from "../f95/filtering";
import type { FilterState, LatestGamesSort } from "../f95/types";
import { SyncMetadataPanel } from "./SyncMetadataPanel";
import type { MetadataSyncState } from "../f95/types";

type SettingsTab = "hosts" | "cookies" | "filters" | "tags" | "data";

type SettingsPageProps = {
  preferredDownloadHosts: string[];
  disabledDownloadHosts: Record<string, number>;
  hiddenDownloadHosts: string[];
  knownDownloadHosts: string[];
  tagsCount: number;
  prefixesCount: number;
  metadataSyncState: MetadataSyncState;
  bundledDefaultFiltersStatus:
    | "checking"
    | "loaded"
    | "not_loaded"
    | "unavailable";
  currentFilterState: FilterState;
  defaultFilterState: FilterState;
  defaultLatestGamesSort: LatestGamesSort;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
  onStartMetadataSync: () => void;
  onUpdateDefaultFilterState: (partialFilterState: Partial<FilterState>) => void;
  onUpdateDefaultLatestGamesSort: (latestGamesSort: LatestGamesSort) => void;
  onResetDefaultFilterState: () => void;
  onImportBundledDefaultFilterState: () => void;
  onSaveCurrentFiltersAsDefault: () => void;
  onApplyDefaultFiltersToSwipe: () => void;
  onMoveDownloadHost: (hostLabel: string, direction: -1 | 1) => void;
  onDisableDownloadHostTemporarily: (hostLabel: string) => void;
  onEnableDownloadHost: (hostLabel: string) => void;
  onShowDownloadHost: (hostLabel: string) => void;
  onResetPreferredDownloadHosts: () => void;
  onClearDisabledDownloadHosts: () => void;
  onClearHiddenDownloadHosts: () => void;
  onImportBundledTagsMap: () => void;
  onOpenImportTagsMap: () => void;
  onImportTagsMapChange: () => void;
  onImportBundledPrefixesMap: () => void;
  onOpenImportPrefixesMap: () => void;
  onImportPrefixesMapChange: () => void;
  onExportAllBackup: () => void;
  onExportSettingsBackup: () => void;
  onExportListsBackup: () => void;
  onOpenImportAllBackup: () => void;
  onImportAllBackupChange: () => void;
  onOpenImportSettingsBackup: () => void;
  onImportSettingsBackupChange: () => void;
  onOpenImportListsBackup: () => void;
  onImportListsBackupChange: () => void;
  onOpenGameFolders: () => void;
  localDataFiles: {
    listsPath: string;
    settingsPath: string;
  } | null;
  onOpenLocalDataFiles: () => void;
  onClearGameFolders: () => void;
  onClearAllLocalData: () => void;
  onResetLocalSettings: () => void;
  onClearDashboardLists: () => void;
  isLauncherAvailable: boolean;
  libraryRootPath: string;
  importAllBackupInputRef: RefObject<HTMLInputElement | null>;
  importSettingsBackupInputRef: RefObject<HTMLInputElement | null>;
  importListsBackupInputRef: RefObject<HTMLInputElement | null>;
  importTagsMapInputRef: RefObject<HTMLInputElement | null>;
  importPrefixesMapInputRef: RefObject<HTMLInputElement | null>;
  requestedTab?: SettingsTab | null;
};

const formatDisabledUntilTime = (expiresAtUnixMs: number) => {
  return new Date(expiresAtUnixMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeSettingsSearchText = (value: string) => value.trim().toLowerCase();

const DEFAULT_SWIPE_SORT_OPTIONS = [
  { value: "date", label: "По дате" },
  { value: "views", label: "По просмотрам" },
] as const;

export const SettingsPage = ({
  preferredDownloadHosts,
  disabledDownloadHosts,
  hiddenDownloadHosts,
  knownDownloadHosts,
  tagsCount,
  prefixesCount,
  metadataSyncState,
  bundledDefaultFiltersStatus,
  currentFilterState,
  defaultFilterState,
  defaultLatestGamesSort,
  tagsMap,
  prefixesMap,
  onStartMetadataSync,
  onUpdateDefaultFilterState,
  onUpdateDefaultLatestGamesSort,
  onResetDefaultFilterState,
  onImportBundledDefaultFilterState,
  onSaveCurrentFiltersAsDefault,
  onApplyDefaultFiltersToSwipe,
  onMoveDownloadHost,
  onDisableDownloadHostTemporarily,
  onEnableDownloadHost,
  onShowDownloadHost,
  onResetPreferredDownloadHosts,
  onClearDisabledDownloadHosts,
  onClearHiddenDownloadHosts,
  onImportBundledTagsMap,
  onOpenImportTagsMap,
  onImportTagsMapChange,
  onImportBundledPrefixesMap,
  onOpenImportPrefixesMap,
  onImportPrefixesMapChange,
  onExportAllBackup,
  onExportSettingsBackup,
  onExportListsBackup,
  onOpenImportAllBackup,
  onImportAllBackupChange,
  onOpenImportSettingsBackup,
  onImportSettingsBackupChange,
  onOpenImportListsBackup,
  onImportListsBackupChange,
  onOpenGameFolders,
  localDataFiles,
  onOpenLocalDataFiles,
  onClearGameFolders,
  onClearAllLocalData,
  onResetLocalSettings,
  onClearDashboardLists,
  isLauncherAvailable,
  libraryRootPath,
  importAllBackupInputRef,
  importSettingsBackupInputRef,
  importListsBackupInputRef,
  importTagsMapInputRef,
  importPrefixesMapInputRef,
  requestedTab = null,
}: SettingsPageProps) => {
  const pausedHostCount = Object.keys(disabledDownloadHosts).length;
  const hiddenHostCount = hiddenDownloadHosts.length;
  const visibleHostList = knownDownloadHosts.filter(
    (hostLabel) => !hiddenDownloadHosts.includes(hostLabel),
  );
  const collapsedHiddenHostList = knownDownloadHosts.filter((hostLabel) =>
    hiddenDownloadHosts.includes(hostLabel),
  );
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    requestedTab ?? "hosts",
  );
  const [cookieProxyStatus, setCookieProxyStatus] =
    useState<CookieProxyStatus | null>(null);
  const [cookieProxyDraft, setCookieProxyDraft] = useState("");
  const [cookieProxyErrorMessage, setCookieProxyErrorMessage] = useState<
    string | null
  >(null);
  const [cookieProxySuccessMessage, setCookieProxySuccessMessage] = useState<
    string | null
  >(null);
  const [isCookieProxyBusy, setIsCookieProxyBusy] = useState(false);
  const [defaultTagSearchText, setDefaultTagSearchText] = useState("");
  const [defaultPrefixSearchText, setDefaultPrefixSearchText] = useState("");
  const cookieFileInputRef = useRef<HTMLInputElement | null>(null);
  const bundledDefaultFiltersStatusText =
    bundledDefaultFiltersStatus === "loaded"
      ? "загружен"
      : bundledDefaultFiltersStatus === "not_loaded"
        ? "не загружен"
        : bundledDefaultFiltersStatus === "unavailable"
          ? "недоступен"
          : "проверяю...";

  const defaultTagOptions = useMemo(() => {
    return Object.entries(tagsMap)
      .map(([tagIdText, label]) => ({
        id: Number(tagIdText),
        label,
      }))
      .filter(
        (option): option is { id: number; label: string } =>
          Number.isInteger(option.id) && typeof option.label === "string",
      )
      .sort((first, second) => first.label.localeCompare(second.label, "ru"));
  }, [tagsMap]);

  const defaultPrefixOptions = useMemo(() => {
    return Object.entries(prefixesMap)
      .map(([prefixIdText, label]) => ({
        id: Number(prefixIdText),
        label,
      }))
      .filter(
        (option): option is { id: number; label: string } =>
          Number.isInteger(option.id) && typeof option.label === "string",
      )
      .sort((first, second) => first.label.localeCompare(second.label, "ru"));
  }, [prefixesMap]);

  const filteredDefaultTagOptions = useMemo(() => {
    const normalizedSearchText = normalizeSettingsSearchText(defaultTagSearchText);
    if (!normalizedSearchText) {
      return defaultTagOptions;
    }

    return defaultTagOptions.filter((option) => {
      return (
        normalizeSettingsSearchText(option.label).includes(normalizedSearchText) ||
        String(option.id).includes(normalizedSearchText)
      );
    });
  }, [defaultTagOptions, defaultTagSearchText]);

  const filteredDefaultPrefixOptions = useMemo(() => {
    const normalizedSearchText = normalizeSettingsSearchText(defaultPrefixSearchText);
    if (!normalizedSearchText) {
      return defaultPrefixOptions;
    }

    return defaultPrefixOptions.filter((option) => {
      return (
        normalizeSettingsSearchText(option.label).includes(normalizedSearchText) ||
        String(option.id).includes(normalizedSearchText)
      );
    });
  }, [defaultPrefixOptions, defaultPrefixSearchText]);

  const selectedDefaultPrefixCount =
    defaultFilterState.includePrefixIds.length +
    defaultFilterState.excludePrefixIds.length;

  const toggleDefaultIncludePrefix = (prefixId: number) => {
    const hasPrefix = defaultFilterState.includePrefixIds.includes(prefixId);
    const nextIncludePrefixIds = hasPrefix
      ? defaultFilterState.includePrefixIds.filter((value) => value !== prefixId)
      : [...defaultFilterState.includePrefixIds, prefixId];

    onUpdateDefaultFilterState({
      includePrefixIds: nextIncludePrefixIds,
      excludePrefixIds: defaultFilterState.excludePrefixIds.filter(
        (value) => value !== prefixId,
      ),
    });
  };

  const toggleDefaultExcludePrefix = (prefixId: number) => {
    const hasPrefix = defaultFilterState.excludePrefixIds.includes(prefixId);
    const nextExcludePrefixIds = hasPrefix
      ? defaultFilterState.excludePrefixIds.filter((value) => value !== prefixId)
      : [...defaultFilterState.excludePrefixIds, prefixId];

    onUpdateDefaultFilterState({
      includePrefixIds: defaultFilterState.includePrefixIds.filter(
        (value) => value !== prefixId,
      ),
      excludePrefixIds: nextExcludePrefixIds,
    });
  };

  const toggleDefaultIncludeTag = (tagId: number) => {
    const hasTag = defaultFilterState.includeTagIds.includes(tagId);
    const isAtLimit =
      !hasTag &&
      defaultFilterState.includeTagIds.length >= MAX_TAG_FILTERS_PER_GROUP;

    if (isAtLimit) {
      return;
    }

    const nextIncludeTagIds = hasTag
      ? defaultFilterState.includeTagIds.filter((value) => value !== tagId)
      : [...defaultFilterState.includeTagIds, tagId];

    onUpdateDefaultFilterState({
      includeTagIds: nextIncludeTagIds,
      excludeTagIds: defaultFilterState.excludeTagIds.filter(
        (value) => value !== tagId,
      ),
    });
  };

  const toggleDefaultExcludeTag = (tagId: number) => {
    const hasTag = defaultFilterState.excludeTagIds.includes(tagId);
    const isAtLimit =
      !hasTag &&
      defaultFilterState.excludeTagIds.length >= MAX_TAG_FILTERS_PER_GROUP;

    if (isAtLimit) {
      return;
    }

    const nextExcludeTagIds = hasTag
      ? defaultFilterState.excludeTagIds.filter((value) => value !== tagId)
      : [...defaultFilterState.excludeTagIds, tagId];

    onUpdateDefaultFilterState({
      includeTagIds: defaultFilterState.includeTagIds.filter(
        (value) => value !== tagId,
      ),
      excludeTagIds: nextExcludeTagIds,
    });
  };

  const renderDefaultFilterOptionGroup = (
    title: string,
    fieldName: string,
    options: Array<{ id: number; label: string }>,
    selectedIds: number[],
    onToggle: (id: number) => void,
    variant: "include" | "exclude",
    countMeta?: string,
  ) => {
    return (
      <div className="swipeFilterModalGroup">
        <div className="swipeFilterModalGroupHeader">
          <div>
            <div className="swipeFilterModalGroupTitle">{title}</div>
            <div className="swipeFilterModalGroupField">{fieldName}</div>
          </div>
          <div className="swipeFilterModalGroupMeta">
            {countMeta ?? `Выбрано: ${selectedIds.length}`}
          </div>
        </div>

        <div className="tagFilterChips swipeFilterModalChipGrid settingsDefaultFilterChipGrid">
          {options.length > 0 ? (
            options.map((option) => {
              const isActive = selectedIds.includes(option.id);
              const activeClassName = isActive
                ? variant === "exclude"
                  ? "tagFilterChipExcludeActive"
                  : "tagFilterChipActive"
                : "";

              return (
                <button
                  key={`${fieldName}-${option.id}`}
                  type="button"
                  className={`tagFilterChip ${activeClassName}`}
                  onClick={() => onToggle(option.id)}
                >
                  {option.label}
                </button>
              );
            })
          ) : (
            <span className="smallText">Ничего не найдено</span>
          )}
        </div>
      </div>
    );
  };

  const defaultFiltersPanel = (
    <>
      <div className="panel">
        <div className="sectionTitleRow">
          <div className="sectionTitle">Дефолтные фильтры свайпа</div>
          <div className="sectionMeta">
            Применяются при сбросе фильтров и на новой сессии
          </div>
        </div>

        <div className="settingsActions">
          <button
            className="button"
            type="button"
            onClick={onImportBundledDefaultFilterState}
          >
            Сбросить к встроенным
          </button>
        </div>

        <div className="smallText settingsHint">
          Здесь задаются сортировка и фильтры, которые будут применяться по
          умолчанию в свайпе.
        </div>

        <div className="smallText">
          Теги ограничены до {MAX_TAG_FILTERS_PER_GROUP} в каждой группе.
          Если выбрать один и тот же тег или префикс в противоположной
          группе, он автоматически уберется оттуда.
        </div>
      </div>

      <div className="settingsDefaultFilterLayout">
        <div className="panel settingsDefaultFilterSectionPanel settingsDefaultFilterSortPanel">
          <div className="swipeFilterModalSectionHeader">
            <div className="swipeFilterModalSectionTitle">Сортировка</div>
            <div className="swipeFilterModalSectionMeta">По умолчанию</div>
          </div>

          <div className="formRow" style={{ marginBottom: 0 }}>
            <div className="label">Сортировка свайпа</div>
            <select
              className="input"
              value={defaultLatestGamesSort}
              onChange={(event) =>
                onUpdateDefaultLatestGamesSort(
                  event.target.value === "views" ? "views" : "date",
                )
              }
            >
              {DEFAULT_SWIPE_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="panel settingsDefaultFilterSectionPanel">
          <div className="swipeFilterModalSectionHeader">
            <div className="swipeFilterModalSectionTitle">Префиксы</div>
            <div className="swipeFilterModalSectionMeta">
              Выбрано: {selectedDefaultPrefixCount}
            </div>
          </div>

          <div className="formRow" style={{ marginBottom: 0 }}>
            <div className="label">Поиск по префиксам</div>
            <input
              className="input"
              value={defaultPrefixSearchText}
              onChange={(event) =>
                setDefaultPrefixSearchText(event.target.value)
              }
              placeholder="например: ren'py, unity"
            />
          </div>

          <div className="swipeFilterModalGroupGrid">
            {renderDefaultFilterOptionGroup(
              "Включить",
              "prefixes[]",
              filteredDefaultPrefixOptions,
              defaultFilterState.includePrefixIds,
              toggleDefaultIncludePrefix,
              "include",
            )}
            {renderDefaultFilterOptionGroup(
              "Выключить",
              "noprefixes[]",
              filteredDefaultPrefixOptions,
              defaultFilterState.excludePrefixIds,
              toggleDefaultExcludePrefix,
              "exclude",
            )}
          </div>
        </div>

        <div className="panel settingsDefaultFilterSectionPanel">
          <div className="swipeFilterModalSectionHeader">
            <div className="swipeFilterModalSectionTitle">Теги</div>
            <div className="swipeFilterModalSectionMeta">
              Включить: {defaultFilterState.includeTagIds.length}/
              {MAX_TAG_FILTERS_PER_GROUP} • Выключить:{" "}
              {defaultFilterState.excludeTagIds.length}/
              {MAX_TAG_FILTERS_PER_GROUP}
            </div>
          </div>

          <div className="formRow" style={{ marginBottom: 0 }}>
            <div className="label">Поиск по тегам</div>
            <input
              className="input"
              value={defaultTagSearchText}
              onChange={(event) =>
                setDefaultTagSearchText(event.target.value)
              }
              placeholder="например: sandbox, corruption"
            />
          </div>

          <div className="swipeFilterModalGroupGrid">
            {renderDefaultFilterOptionGroup(
              "Включить",
              "tags[]",
              filteredDefaultTagOptions,
              defaultFilterState.includeTagIds,
              toggleDefaultIncludeTag,
              "include",
              `${defaultFilterState.includeTagIds.length}/${MAX_TAG_FILTERS_PER_GROUP}`,
            )}
            {renderDefaultFilterOptionGroup(
              "Выключить",
              "notags[]",
              filteredDefaultTagOptions,
              defaultFilterState.excludeTagIds,
              toggleDefaultExcludeTag,
              "exclude",
              `${defaultFilterState.excludeTagIds.length}/${MAX_TAG_FILTERS_PER_GROUP}`,
            )}
          </div>
        </div>
      </div>
    </>
  );

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const nextStatus = await fetchCookieProxyStatus();
        if (!isCancelled) {
          setCookieProxyStatus(nextStatus);
        }
      } catch (error) {
        if (!isCancelled) {
          setCookieProxyErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось получить статус cookie proxy",
          );
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const handleSaveCookieProxyInput = async () => {
    try {
      setIsCookieProxyBusy(true);
      setCookieProxyErrorMessage(null);
      setCookieProxySuccessMessage(null);
      const nextStatus = await saveCookieProxyInput(cookieProxyDraft);
      setCookieProxyStatus(nextStatus);
      setCookieProxySuccessMessage(
        "Куки сохранены. Proxy начнет использовать их без перезапуска dev-сервера.",
      );
    } catch (error) {
      setCookieProxyErrorMessage(
        error instanceof Error ? error.message : "Не удалось сохранить куки",
      );
    } finally {
      setIsCookieProxyBusy(false);
    }
  };

  const handleClearCookieProxyInput = async () => {
    try {
      setIsCookieProxyBusy(true);
      setCookieProxyErrorMessage(null);
      setCookieProxySuccessMessage(null);
      const nextStatus = await clearCookieProxyInput();
      setCookieProxyStatus(nextStatus);
      setCookieProxyDraft("");
      setCookieProxySuccessMessage(
        nextStatus.source === "env"
          ? "Сохраненные через приложение куки удалены. Proxy снова использует F95_COOKIE из .env."
          : "Сохраненные через приложение куки удалены.",
      );
    } catch (error) {
      setCookieProxyErrorMessage(
        error instanceof Error ? error.message : "Не удалось очистить куки",
      );
    } finally {
      setIsCookieProxyBusy(false);
    }
  };

  const handleCookieFileChange = async () => {
    const file = cookieFileInputRef.current?.files?.[0];
    if (!file) {
      return;
    }

    try {
      const fileText = await file.text();
      setCookieProxyDraft(fileText);
      setCookieProxyErrorMessage(null);
      setCookieProxySuccessMessage(
        `Файл ${file.name} загружен в поле. Теперь нажми "Сохранить в proxy".`,
      );
    } catch (error) {
      setCookieProxyErrorMessage(
        error instanceof Error ? error.message : "Не удалось прочитать файл",
      );
    }
  };

  return (
    <div className="settingsPage">
      <div className="settingsHeaderTop">
        <div className="settingsPageIntro">
          <h3 className="panelTitle settingsPageTitle">Настройки</h3>
          <div className="smallText">
            Разделы вынесены во вкладки: host'ы, куки для proxy, фильтры,
            метаданные и локальное хранилище.
          </div>
        </div>

        <div className="settingsTabBar" role="tablist" aria-label="Настройки">
          <button
            className={`button settingsTabButton ${
              activeTab === "hosts" ? "settingsTabButtonActive" : ""
            }`}
            type="button"
            role="tab"
            aria-selected={activeTab === "hosts"}
            onClick={() => setActiveTab("hosts")}
          >
            Хосты
          </button>
          <button
            className={`button settingsTabButton ${
              activeTab === "cookies" ? "settingsTabButtonActive" : ""
            }`}
              type="button"
              role="tab"
              aria-selected={activeTab === "cookies"}
              onClick={() => setActiveTab("cookies")}
          >
            Куки
          </button>
          <button
            className={`button settingsTabButton ${
              activeTab === "filters" ? "settingsTabButtonActive" : ""
            }`}
            type="button"
            role="tab"
            aria-selected={activeTab === "filters"}
            onClick={() => setActiveTab("filters")}
          >
            Фильтры
          </button>
          <button
            className={`button settingsTabButton ${
              activeTab === "tags" ? "settingsTabButtonActive" : ""
            }`}
            type="button"
            role="tab"
            aria-selected={activeTab === "tags"}
            onClick={() => setActiveTab("tags")}
          >
            Метаданные
          </button>
          <button
            className={`button settingsTabButton ${
              activeTab === "data" ? "settingsTabButtonActive" : ""
            }`}
              type="button"
            role="tab"
            aria-selected={activeTab === "data"}
            onClick={() => setActiveTab("data")}
          >
            Локально
          </button>
        </div>
      </div>

      <div className="settingsContent">
        {activeTab === "hosts" ? (
          <>
            <div className="panel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">One-click и зеркала</div>
                <div className="sectionMeta">
                  Порядок сверху вниз влияет на one-click
                </div>
              </div>

              <div className="settingsSummaryGrid">
                <div className="metricCard">
                  <div className="metricLabel">Первый в списке</div>
                  <div className="metricValue settingsMetricValue">
                    {preferredDownloadHosts[0] ?? "Нет"}
                  </div>
                </div>
                <div className="metricCard">
                  <div className="metricLabel">На паузе</div>
                  <div className="metricValue settingsMetricValue">
                    {pausedHostCount}
                  </div>
                </div>
                <div className="metricCard">
                  <div className="metricLabel">Скрыто</div>
                  <div className="metricValue settingsMetricValue">
                    {hiddenHostCount}
                  </div>
                </div>
                <div className="metricCard">
                  <div className="metricLabel">Известные host'ы</div>
                  <div className="metricValue settingsMetricValue">
                    {knownDownloadHosts.length}
                  </div>
                </div>
              </div>

              <div className="settingsActions">
                <button
                  className="button"
                  type="button"
                  onClick={onResetPreferredDownloadHosts}
                >
                  Сбросить приоритеты
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={onClearDisabledDownloadHosts}
                  disabled={pausedHostCount === 0}
                >
                  Включить все хосты
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={onClearHiddenDownloadHosts}
                  disabled={hiddenHostCount === 0}
                >
                  Показать все хосты
                </button>
              </div>

              <div className="smallText settingsHint">
                `Выше` и `Ниже` меняют место в общем списке. `Пауза 1ч`
                временно исключает host из one-click. Если раньше что-то было
                скрыто, его можно вернуть через блок ниже.
              </div>
            </div>

            <div className="panel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Хосты</div>
                <div className="sectionMeta">
                  Активный список для one-click
                </div>
              </div>

              <div className="settingsHostGrid">
                {visibleHostList.map((hostLabel, index) => {
                  const isFirstInList = index === 0;
                  const disabledUntilUnixMs = disabledDownloadHosts[hostLabel];
                  const isTemporarilyDisabled =
                    typeof disabledUntilUnixMs === "number" &&
                    disabledUntilUnixMs > Date.now();
                  const canMoveUp = index > 0;
                  const canMoveDown = index < visibleHostList.length - 1;

                  const statusParts: string[] = [];
                  if (isTemporarilyDisabled && disabledUntilUnixMs) {
                    statusParts.push(
                      `Пауза до ${formatDisabledUntilTime(disabledUntilUnixMs)}`,
                    );
                  }
                  if (!isTemporarilyDisabled && isFirstInList) {
                    statusParts.push("Первый для one-click");
                  }
                  if (statusParts.length === 0) {
                    statusParts.push(`Позиция ${index + 1} в общем порядке`);
                  }

                  return (
                    <div
                      key={hostLabel}
                      className={`settingsHostCard ${
                        isFirstInList ? "settingsHostCardPrimary" : ""
                      } ${
                        isTemporarilyDisabled ? "settingsHostCardDisabled" : ""
                      }`}
                    >
                      <div className="settingsHostHeader">
                        <div className="settingsHostName">{hostLabel}</div>
                        <div className="settingsHostBadge">#{index + 1}</div>
                      </div>

                      <div className="settingsHostStatusRow">
                        {isFirstInList ? (
                          <span className="settingsHostStatusChip settingsHostStatusChipPrimary">
                            #1
                          </span>
                        ) : null}
                        {isTemporarilyDisabled ? (
                          <span className="settingsHostStatusChip settingsHostStatusChipPaused">
                            Пауза
                          </span>
                        ) : null}
                      </div>

                      <div className="settingsHostMeta">
                        {statusParts.join(" • ")}
                      </div>

                      <div className="settingsHostActions">
                        <div className="settingsHostActionRow">
                          <button
                            className="button settingsHostActionButton"
                            type="button"
                            onClick={() => onMoveDownloadHost(hostLabel, -1)}
                            disabled={!canMoveUp}
                          >
                            Выше
                          </button>
                          <button
                            className="button settingsHostActionButton"
                            type="button"
                            onClick={() => onMoveDownloadHost(hostLabel, 1)}
                            disabled={!canMoveDown}
                          >
                            Ниже
                          </button>
                        </div>
                        <div className="settingsHostActionRow">
                          <button
                            className={`button settingsHostActionButton ${
                              isTemporarilyDisabled
                                ? "settingsHostActionButtonResume"
                                : "settingsHostActionButtonPause"
                            }`}
                            type="button"
                            onClick={() =>
                              isTemporarilyDisabled
                                ? onEnableDownloadHost(hostLabel)
                                : onDisableDownloadHostTemporarily(hostLabel)
                            }
                          >
                            {isTemporarilyDisabled ? "Вернуть" : "Пауза 1ч"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {collapsedHiddenHostList.length > 0 ? (
                <details className="settingsHiddenHosts">
                  <summary className="settingsHiddenHostsSummary">
                    Скрытые host'ы: {collapsedHiddenHostList.length}
                  </summary>
                  <div className="settingsHiddenHostsGrid">
                    {collapsedHiddenHostList.map((hostLabel) => {
                      const disabledUntilUnixMs = disabledDownloadHosts[hostLabel];
                      const isTemporarilyDisabled =
                        typeof disabledUntilUnixMs === "number" &&
                        disabledUntilUnixMs > Date.now();
                      const originalIndex =
                        knownDownloadHosts.indexOf(hostLabel) + 1;

                      return (
                        <div key={hostLabel} className="settingsHiddenHostCard">
                          <div className="settingsHostHeader">
                            <div className="settingsHostName">{hostLabel}</div>
                            <div className="settingsHostBadge">#{originalIndex}</div>
                          </div>
                          <div className="settingsHiddenHostMeta">
                            {isTemporarilyDisabled && disabledUntilUnixMs
                              ? `Скрыт • пауза до ${formatDisabledUntilTime(disabledUntilUnixMs)}`
                              : "Скрыт вручную"}
                          </div>
                          <div className="settingsHiddenHostActions">
                            <button
                              className="button settingsHostActionButton settingsHostActionButtonResume"
                              type="button"
                              onClick={() => onShowDownloadHost(hostLabel)}
                            >
                              Показать
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ) : null}
            </div>
          </>
        ) : activeTab === "cookies" ? (
          <>
            <div className="panel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Куки для proxy</div>
                <div className="sectionMeta">
                  Локальный proxy для реальных mirrors
                </div>
              </div>

              <div className="settingsSummaryGrid settingsCookieStatusGrid">
                <div className="metricCard">
                  <div className="metricLabel">Статус</div>
                  <div className="metricValue settingsMetricValue">
                    {cookieProxyStatus?.configured ? "Активен" : "Не задан"}
                  </div>
                </div>
                <div className="metricCard">
                  <div className="metricLabel">Источник</div>
                  <div className="metricValue settingsMetricValue">
                    {cookieProxyStatus?.source === "settings"
                      ? "Вкладка"
                      : cookieProxyStatus?.source === "env"
                        ? ".env"
                        : "Нет"}
                  </div>
                </div>
                <div className="metricCard">
                  <div className="metricLabel">Найдено cookies</div>
                  <div className="metricValue settingsMetricValue">
                    {cookieProxyStatus?.cookieNames.length ?? 0}
                  </div>
                </div>
                <div className="metricCard">
                  <div className="metricLabel">Не хватает</div>
                  <div className="metricValue settingsMetricValue">
                    {cookieProxyStatus?.missingRecommendedCookieNames.length ?? 3}
                  </div>
                </div>
              </div>

              <div className="settingsCookieMeta">
                <div className="smallText">
                  Поддерживается `F95_COOKIE="..."`, `cookies.txt`, JSON и
                  таблица из DevTools.
                </div>
                <div className="smallText">
                  После сохранения proxy начинает использовать эти куки сразу,
                  без перезапуска `pnpm dev`.
                </div>
              </div>

              {cookieProxyStatus?.cookieNames.length ? (
                <div className="settingsCookieNames">
                  {cookieProxyStatus.cookieNames.map((cookieName) => (
                    <span key={cookieName} className="pill">
                      {cookieName}
                    </span>
                  ))}
                </div>
              ) : null}

              {cookieProxyStatus?.missingRecommendedCookieNames.length ? (
                <div className="smallText settingsCookieWarning">
                  Не найдены рекомендуемые cookies:{" "}
                  {cookieProxyStatus.missingRecommendedCookieNames.join(", ")}
                </div>
              ) : null}

              {cookieProxyErrorMessage ? (
                <div className="downloadEmptyState">{cookieProxyErrorMessage}</div>
              ) : null}

              {cookieProxySuccessMessage ? (
                <div className="downloadNotice">{cookieProxySuccessMessage}</div>
              ) : null}
            </div>

            <div className="panel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Вставить куки</div>
                <div className="sectionMeta">
                  Можно вставить текст или загрузить файл
                </div>
              </div>

              <div className="settingsCookieActions">
                <button
                  className="button buttonPrimary"
                  type="button"
                  onClick={() => {
                    void handleSaveCookieProxyInput();
                  }}
                  disabled={isCookieProxyBusy || cookieProxyDraft.trim().length === 0}
                >
                  Сохранить в proxy
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => cookieFileInputRef.current?.click()}
                  disabled={isCookieProxyBusy}
                >
                  Выбрать файл
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    void handleClearCookieProxyInput();
                  }}
                  disabled={isCookieProxyBusy}
                >
                  Очистить сохраненные
                </button>
              </div>

              <textarea
                className="input settingsCookieTextarea"
                value={cookieProxyDraft}
                onChange={(event) => setCookieProxyDraft(event.target.value)}
                placeholder={`F95_COOKIE="xf_user=...; xf_session=...; xf_csrf=..."`}
                rows={10}
              />

              <input
                ref={cookieFileInputRef}
                type="file"
                accept=".txt,.json,.cookies,text/plain,application/json"
                hidden
                onChange={() => {
                  void handleCookieFileChange();
                }}
              />

              <div className="settingsDataNote">
                <div className="smallText">
                  Если вставляешь экспорт из браузера, можно просто закинуть
                  весь `cookies.txt` или скопированную таблицу из DevTools.
                </div>
                <div className="smallText">
                  Если у тебя уже есть `.env`, эта вкладка может временно
                  переопределить `F95_COOKIE`.
                </div>
              </div>
            </div>
          </>
        ) : activeTab === "filters" ? (
          <>{defaultFiltersPanel}</>
        ) : activeTab === "tags" ? (
          <>
            <SyncMetadataPanel
              metadataSyncState={metadataSyncState}
              autoSyncEnabled={false}
              onStartSync={onStartMetadataSync}
            />

            <div className="panel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Дефолтные фильтры</div>
                <div className="sectionMeta">
                  Встроенный `default-filters.json`
                </div>
              </div>

              <div className="settingsActions">
                <button
                  className="button buttonPrimary"
                  type="button"
                  onClick={onImportBundledDefaultFilterState}
                >
                  Загрузить встроенные дефолтные фильтры
                </button>
              </div>

              <div className="smallText" style={{ marginTop: 8 }}>
                Статус: {bundledDefaultFiltersStatusText}
              </div>

              <div className="settingsDataNote">
                <div className="smallText">
                  Берет локальный `/default-filters.json` из проекта и
                  обновляет дефолтные фильтры и сортировку на вкладке
                  `Фильтры`.
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Теги</div>
                <div className="sectionMeta">
                  Локальная карта {"`id -> label`"} для интерфейса
                </div>
              </div>

              <div className="settingsSummaryGrid settingsTagStatusGrid">
                <div className="metricCard">
                  <div className="metricLabel">Загружено тегов</div>
                  <div className="metricValue settingsMetricValue">
                    {tagsCount}
                  </div>
                </div>
              </div>

              <div className="settingsActions">
                <button
                  className="button buttonPrimary"
                  type="button"
                  onClick={onImportBundledTagsMap}
                >
                  Загрузить встроенные теги
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={onOpenImportTagsMap}
                >
                  Импорт tags.json
                </button>
              </div>

              <input
                ref={importTagsMapInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={onImportTagsMapChange}
              />

              <div className="settingsDataNote">
                <div className="smallText">
                  `Загрузить встроенные теги` берет локальный `/tags.json` из
                  проекта одним кликом.
                </div>
                <div className="smallText">
                  Формат: {`{ "45": "3D", "130": "RenPy" }`}
                </div>
                <div className="smallText">
                  Эти данные используются для подписей тегов в карточках и
                  дашборде.
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Префиксы</div>
                <div className="sectionMeta">
                  Локальная карта {"`id -> label`"} для префиксов
                </div>
              </div>

              <div className="settingsSummaryGrid settingsTagStatusGrid">
                <div className="metricCard">
                  <div className="metricLabel">Загружено префиксов</div>
                  <div className="metricValue settingsMetricValue">
                    {prefixesCount}
                  </div>
                </div>
              </div>

              <div className="settingsActions">
                <button
                  className="button buttonPrimary"
                  type="button"
                  onClick={onImportBundledPrefixesMap}
                >
                  Загрузить встроенные префиксы
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={onOpenImportPrefixesMap}
                >
                  Импорт prefixes.json
                </button>
              </div>

              <input
                ref={importPrefixesMapInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={onImportPrefixesMapChange}
              />

              <div className="settingsDataNote">
                <div className="smallText">
                  `Загрузить встроенные префиксы` берет локальный
                  `/prefixes.json` из проекта одним кликом.
                </div>
                <div className="smallText">
                  Формат: {`{ "7": "Ren'Py", "3": "Unity" }`}
                </div>
                <div className="smallText">
                  Эти данные сохраняются локально и экспортируются вместе с
                  сессией.
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="panel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Библиотека игр</div>
                <div className="sectionMeta">
                  Действия с локальной папкой launcher
                </div>
              </div>

              <div className="settingsActions">
                <button
                  className="button"
                  type="button"
                  onClick={onOpenGameFolders}
                  disabled={!isLauncherAvailable}
                >
                  Открыть папку с играми
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={onClearGameFolders}
                  disabled={!isLauncherAvailable}
                >
                  Очистить папки с играми
                </button>
              </div>

              <div className="settingsDataNote">
                <div className="smallText">
                  `Открыть папку с играми` открывает корневую папку локальной
                  библиотеки launcher'а в проводнике.
                </div>
                <div className="smallText">
                  `Очистить папки с играми` удаляет локальную библиотеку
                  лаунчера вместе с архивами и распакованными играми.
                </div>
                <div className="smallText">
                  {isLauncherAvailable && libraryRootPath
                    ? `Папка библиотеки: ${libraryRootPath}`
                    : "Действия с папкой игр доступны только в Electron-версии приложения."}
                </div>
              </div>
            </div>

            <div className="settingsLocalActionGrid">
              <div className="panel settingsLocalActionPanel">
                <div className="sectionTitleRow">
                  <div className="sectionTitle">Файлы</div>
                  <div className="sectionMeta">Автосохранение Electron</div>
                </div>

                <div className="settingsActions">
                  <button
                    className="button"
                    type="button"
                    onClick={onOpenLocalDataFiles}
                    disabled={!localDataFiles}
                  >
                    Открыть папку локальных файлов
                  </button>
                </div>

                <div className="settingsDataNote">
                  <div className="smallText">
                    В Electron списки и настройки теперь подтягиваются из
                    отдельных JSON-файлов, а не из `localStorage`.
                  </div>
                  <div className="smallText">
                    {localDataFiles
                      ? `Файл списков: ${localDataFiles.listsPath}`
                      : "Файлы локального состояния доступны только в Electron-версии приложения."}
                  </div>
                  {localDataFiles ? (
                    <div className="smallText">
                      {`Файл настроек: ${localDataFiles.settingsPath}`}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="panel settingsLocalActionPanel">
                <div className="sectionTitleRow">
                  <div className="sectionTitle">Экспорт</div>
                  <div className="sectionMeta">Собрать JSON-бэкап</div>
                </div>

                <div className="settingsLocalButtonGrid">
                  <button
                    className="button"
                    type="button"
                    onClick={onExportAllBackup}
                  >
                    Все сразу
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={onExportSettingsBackup}
                  >
                    Только настройки
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={onExportListsBackup}
                  >
                    Только списки
                  </button>
                </div>

                <div className="settingsDataNote">
                  <div className="smallText">
                    `Все сразу` сохраняет и списки дашборда, и все локальные
                    пользовательские настройки в один backup-файл.
                  </div>
                  <div className="smallText">
                    `Только настройки` сохраняет дефолтные фильтры,
                    `tagsMap/prefixesMap`, настройки host'ов и локальные куки
                    proxy.
                  </div>
                  <div className="smallText">
                    `Только списки` сохраняет session-данные и tracked-списки
                    так же, как раньше локальный экспорт.
                  </div>
                </div>
              </div>

              <div className="panel settingsLocalActionPanel">
                <div className="sectionTitleRow">
                  <div className="sectionTitle">Импорт</div>
                  <div className="sectionMeta">Восстановить из JSON</div>
                </div>

                <div className="settingsLocalButtonGrid">
                  <button
                    className="button"
                    type="button"
                    onClick={onOpenImportAllBackup}
                  >
                    Все сразу
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={onOpenImportSettingsBackup}
                  >
                    Только настройки
                  </button>
                  <button
                    className="button"
                    type="button"
                    onClick={onOpenImportListsBackup}
                  >
                    Только списки
                  </button>
                </div>

                <input
                  ref={importAllBackupInputRef}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={() => {
                    void onImportAllBackupChange();
                  }}
                />
                <input
                  ref={importSettingsBackupInputRef}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={() => {
                    void onImportSettingsBackupChange();
                  }}
                />
                <input
                  ref={importListsBackupInputRef}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={() => {
                    void onImportListsBackupChange();
                  }}
                />

                <div className="settingsDataNote">
                  <div className="smallText">
                    Импорт `всего` восстанавливает и списки, и настройки, затем
                    перезагружает приложение.
                  </div>
                  <div className="smallText">
                    Импорт `настроек` можно использовать отдельно, если нужно
                    перенести только локальную конфигурацию без tracked-истории.
                  </div>
                  <div className="smallText">
                    Импорт `списков` понимает и новый backup, и старый
                    `session`-формат.
                  </div>
                </div>
              </div>

              <div className="panel settingsLocalActionPanel">
                <div className="sectionTitleRow">
                  <div className="sectionTitle">Удаление</div>
                  <div className="sectionMeta">Очистка и сброс</div>
                </div>

                <div className="settingsLocalButtonGrid">
                  <button
                    className="button buttonDanger"
                    type="button"
                    onClick={onClearAllLocalData}
                  >
                    Все сразу
                  </button>
                  <button
                    className="button buttonDanger"
                    type="button"
                    onClick={onResetLocalSettings}
                  >
                    Сбросить настройки
                  </button>
                  <button
                    className="button buttonDanger"
                    type="button"
                    onClick={onClearDashboardLists}
                  >
                    Очистить списки
                  </button>
                </div>

                <div className="settingsDataNote">
                  <div className="smallText">
                    `Все сразу` чистит локальные списки, настройки, кэш и
                    сохраненные через приложение куки proxy, но не трогает
                    папку игр launcher'а.
                  </div>
                  <div className="smallText">
                    `Сбросить настройки` оставляет tracked-списки как есть, но
                    возвращает локальную конфигурацию к начальному состоянию.
                  </div>
                  <div className="smallText">
                    `Очистить списки` сбрасывает только `Закладки`, `Мусор` и
                    `Играл`.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export type { SettingsTab };
