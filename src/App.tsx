import { useCallback, useEffect, useMemo, useState } from "react";
import { buildThreadLink, isLikelyCookieRefreshErrorMessage } from "./f95/api";
import {
  clearDisabledDownloadHosts,
  clearHiddenDownloadHosts,
  disableDownloadHostTemporarily,
  enableDownloadHost,
  loadDisabledDownloadHosts,
  loadHiddenDownloadHosts,
  loadKnownDownloadHosts,
  loadPreferredDownloadHosts,
  moveDownloadHostPreference,
  removeCachedThreadDownloads,
  resetPreferredDownloadHosts,
  savePreferredDownloadHosts,
  showDownloadHost,
  sortDownloadHostsByPreference,
} from "./f95/downloads";
import { useF95Browser } from "./f95/useF95Browser";
import type { ListType } from "./f95/types";
import { Dashboard as ListsDashboard } from "./components/Dashboard";
import { DashboardOverview } from "./components/DashboardOverview";
import { CookiePromptModal } from "./components/CookiePromptModal";
import { SettingsPage } from "./components/SettingsPage";
import { AppTopBar } from "./components/AppTopBar";
import { ImageViewerOverlay } from "./components/ImageViewerOverlay";
import { StartupSplash } from "./components/StartupSplash";
import { SwipePage } from "./components/SwipePage";
import {
  openLinkInBackground,
  openLinkInNewTab,
} from "./app/linking";
import {
  pickCoverForLink,
  pickCreatorForLink,
  pickRatingForLink,
  pickTitleForLink,
} from "./app/threadSelectors";
import { useAppDataActions } from "./hooks/useAppDataActions";
import { useAppDownloadActions } from "./hooks/useAppDownloadActions";
import { useHashNavigation } from "./hooks/useHashNavigation";
import { useLauncherLibrary } from "./launcher/useLauncherLibrary";

const App = () => {
  const {
    sessionState,
    orderedSwipeThreadIdentifiers,
    currentThreadIdentifier,
    currentThreadItem,
    isLoadingPage,
    errorMessage,
    canUndo,
    applyActionToCurrentCard,
    undoLastAction,
    updateFilterState,
    setLatestGamesSort,
    setSwipeSortMode,
    resetFilterState,
    defaultFilterState,
    defaultLatestGamesSort,
    updateDefaultFilterState,
    updateDefaultLatestGamesSort,
    replaceDefaultSwipeSettings,
    resetDefaultFilterState,
    saveCurrentFilterStateAsDefault,
    applyDefaultFilterStateToSwipe,
    clearDashboardLists,
    setErrorMessage,
    tagsMap,
    prefixesMap,
    updateTagsMap,
    updatePrefixesMap,
    metadataSyncState,
    startMetadataSync,
    pauseMetadataSync,
    resumeMetadataSync,
    stopMetadataSync,
    moveLinkToList,
    togglePlayedFavoriteLink,
    togglePlayedDislikedLink,
    toggleBookmarkedDownloadedLink,
    removeLinkFromList,
  } = useF95Browser();
  const {
    isAvailable: isLauncherAvailable,
    gamesByThreadLink: launcherGamesByThreadLink,
    libraryRootPath,
    downloadGame,
    cancelDownloadGame,
    clearLibrary,
    chooseInstallFolder,
    chooseLaunchTarget,
    deleteGameFiles,
    launchGame,
    openLibraryFolder,
    openMirrorForGame,
  } = useLauncherLibrary();
  const { pageType, requestedSettingsTab, setPage } = useHashNavigation();

  const [preferredDownloadHosts, setPreferredDownloadHosts] = useState<string[]>(
    () => loadPreferredDownloadHosts(),
  );
  const [disabledDownloadHosts, setDisabledDownloadHosts] = useState<
    Record<string, number>
  >(() => loadDisabledDownloadHosts());
  const [hiddenDownloadHosts, setHiddenDownloadHosts] = useState<string[]>(() =>
    loadHiddenDownloadHosts(),
  );
  const [isStartupSplashVisible, setIsStartupSplashVisible] = useState(true);

  const currentThreadLink = useMemo(() => {
    if (currentThreadIdentifier === null) {
      return null;
    }
    return buildThreadLink(currentThreadIdentifier);
  }, [currentThreadIdentifier]);

  const {
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
  } = useAppDataActions({
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
  });

  const {
    closeCookiePromptModal,
    closeDownloadModal,
    closeViewer,
    cookiePromptModalState,
    downloadModalState,
    handleClearGameFolders,
    handleOpenGameFolders,
    handleSaveCookiePrompt,
    isCookiePromptBusy,
    knownDownloadHosts,
    openViewer,
    setCookiePromptDraft,
    showNextViewerImage,
    showPreviousViewerImage,
    viewerState,
  } = useAppDownloadActions({
    isLauncherAvailable,
    launcherGamesByThreadLink,
    preferredDownloadHosts,
    disabledDownloadHosts,
    hiddenDownloadHosts,
    setErrorMessage,
    downloadGame,
    cancelDownloadGame,
    clearLibrary,
    chooseInstallFolder,
    chooseLaunchTarget,
    deleteGameFiles,
    launchGame,
    openLibraryFolder,
    openMirrorForGame,
  });

  const handleMoveDownloadHost = useCallback(
    (hostLabel: string, direction: -1 | 1) => {
      setPreferredDownloadHosts((previousState) => {
        const orderedHostList = sortDownloadHostsByPreference(
          loadKnownDownloadHosts(),
          previousState,
        );
        const currentIndex = orderedHostList.indexOf(hostLabel);
        if (currentIndex === -1) {
          return previousState;
        }

        let targetIndex = currentIndex + direction;
        while (
          targetIndex >= 0 &&
          targetIndex < orderedHostList.length &&
          hiddenDownloadHosts.includes(orderedHostList[targetIndex])
        ) {
          targetIndex += direction;
        }

        if (targetIndex < 0 || targetIndex >= orderedHostList.length) {
          return previousState;
        }

        const nextState = moveDownloadHostPreference(
          orderedHostList,
          hostLabel,
          targetIndex,
        );
        savePreferredDownloadHosts(nextState);
        return nextState;
      });
    },
    [hiddenDownloadHosts],
  );

  const handleDisableDownloadHostTemporarily = useCallback((hostLabel: string) => {
    setDisabledDownloadHosts(disableDownloadHostTemporarily(hostLabel));
  }, []);

  const handleEnableDownloadHost = useCallback((hostLabel: string) => {
    setDisabledDownloadHosts(enableDownloadHost(hostLabel));
  }, []);

  const handleResetPreferredDownloadHosts = useCallback(() => {
    const nextHostList = resetPreferredDownloadHosts();
    setPreferredDownloadHosts(nextHostList);
  }, []);

  const handleClearDisabledDownloadHosts = useCallback(() => {
    clearDisabledDownloadHosts();
    setDisabledDownloadHosts({});
  }, []);

  const handleShowDownloadHost = useCallback((hostLabel: string) => {
    setHiddenDownloadHosts(showDownloadHost(hostLabel));
  }, []);

  const handleClearHiddenDownloadHosts = useCallback(() => {
    clearHiddenDownloadHosts();
    setHiddenDownloadHosts([]);
  }, []);

  const removeDownloadCacheForListType = useCallback(
    (threadLink: string, listType: ListType) => {
      if (listType === "trash" || listType === "played") {
        removeCachedThreadDownloads(threadLink);
      }
    },
    [],
  );

  const isSwipeInteractionLocked =
    metadataSyncState.isRunning && !metadataSyncState.isPaused;

  const handleFavorite = useCallback(() => {
    if (isSwipeInteractionLocked) {
      return;
    }
    applyActionToCurrentCard("favorite");
  }, [applyActionToCurrentCard, isSwipeInteractionLocked]);

  const handleTrash = useCallback(() => {
    if (isSwipeInteractionLocked) {
      return;
    }
    if (currentThreadLink) {
      removeCachedThreadDownloads(currentThreadLink);
    }
    applyActionToCurrentCard("trash");
  }, [applyActionToCurrentCard, currentThreadLink, isSwipeInteractionLocked]);

  const handlePlayed = useCallback(() => {
    if (isSwipeInteractionLocked) {
      return;
    }
    if (currentThreadLink) {
      removeCachedThreadDownloads(currentThreadLink);
    }
    applyActionToCurrentCard("played");
  }, [applyActionToCurrentCard, currentThreadLink, isSwipeInteractionLocked]);

  const handlePlayedFavorite = useCallback(() => {
    if (isSwipeInteractionLocked) {
      return;
    }
    if (currentThreadLink) {
      removeCachedThreadDownloads(currentThreadLink);
    }
    applyActionToCurrentCard("playedFavorite");
  }, [applyActionToCurrentCard, currentThreadLink, isSwipeInteractionLocked]);

  const handleManualMetadataSync = useCallback(() => {
    void startMetadataSync();
  }, [startMetadataSync]);

  const handlePauseMetadataSync = useCallback(() => {
    pauseMetadataSync();
  }, [pauseMetadataSync]);

  const handleResumeMetadataSync = useCallback(() => {
    resumeMetadataSync();
  }, [resumeMetadataSync]);

  const handleStopMetadataSync = useCallback(() => {
    stopMetadataSync();
  }, [stopMetadataSync]);

  const handleMoveLinkToList = useCallback(
    (threadLink: string, listType: ListType) => {
      removeDownloadCacheForListType(threadLink, listType);
      moveLinkToList(threadLink, listType);
    },
    [moveLinkToList, removeDownloadCacheForListType],
  );

  const openCurrentThreadPage = useCallback(() => {
    if (currentThreadLink) {
      openLinkInNewTab(currentThreadLink);
    }
  }, [currentThreadLink]);

  const openCurrentThreadPageInBackground = useCallback(() => {
    if (currentThreadLink) {
      openLinkInBackground(currentThreadLink);
    }
  }, [currentThreadLink]);

  const openCookieSettingsPage = useCallback(() => {
    closeCookiePromptModal();
    setPage("settings", "cookies");
  }, [closeCookiePromptModal, setPage]);

  const startupCatalogCount = Object.keys(
    sessionState.threadItemsByIdentifier,
  ).length;
  const hasStartupCatalogData = startupCatalogCount > 0;
  const hasInlineStartupRetryWait =
    metadataSyncState.isRunning && metadataSyncState.nextRetryAtUnixMs !== null;
  const hasPendingStartupRetry =
    metadataSyncState.nextRetryAtUnixMs !== null && !hasStartupCatalogData;
  const shouldKeepStartupSplashVisible =
    isLoadingPage ||
    ((metadataSyncState.isRunning || hasPendingStartupRetry) &&
      !hasStartupCatalogData);
  const startupSplashProgressPercent = metadataSyncState.isRunning
    ? metadataSyncState.pageLimit > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (metadataSyncState.currentPage / metadataSyncState.pageLimit) * 100,
            ),
          ),
        )
      : null
    : hasStartupCatalogData
      ? 100
      : null;
  const startupSplashStatusText = metadataSyncState.isStopping
    ? "Завершаю стартовую синхронизацию..."
    : metadataSyncState.isPaused
      ? "Стартовая синхронизация на паузе"
      : hasInlineStartupRetryWait
        ? "Жду окно для повторного запроса к latest"
        : metadataSyncState.isRunning
          ? "Собираю стартовый каталог latest"
          : hasPendingStartupRetry
            ? "Жду автоповтор стартовой синхронизации"
            : hasStartupCatalogData
              ? "Локальный каталог готов"
              : "Поднимаю локальные данные";
  const startupSplashMetaText = hasInlineStartupRetryWait
    ? "Сервер временно ограничил запросы. Следующая попытка будет запущена автоматически."
    : metadataSyncState.isRunning
      ? `Страница ${metadataSyncState.currentPage || 0}${
          metadataSyncState.pageLimit > 0
            ? ` из ${metadataSyncState.pageLimit}`
            : ""
        } • Сохранено игр: ${metadataSyncState.syncedCount}`
      : hasPendingStartupRetry
        ? "Сервер временно ограничил запросы. Приложение продолжит синхронизацию автоматически."
        : hasStartupCatalogData
          ? `Загружено из локального каталога: ${startupCatalogCount}`
          : "Читаю списки, настройки и стартовый каталог.";

  useEffect(() => {
    if (!isStartupSplashVisible || shouldKeepStartupSplashVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsStartupSplashVisible(false);
    }, hasStartupCatalogData ? 420 : 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    hasStartupCatalogData,
    isStartupSplashVisible,
    shouldKeepStartupSplashVisible,
  ]);

  const cookieRefreshNoticeMessage = useMemo(() => {
    if (!isLikelyCookieRefreshErrorMessage(metadataSyncState.error)) {
      return null;
    }

    return "Не удалось проверить обновления. Похоже, F95 не принял текущие куки. Обнови их во вкладке Куки.";
  }, [metadataSyncState.error]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (downloadModalState.isOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeDownloadModal();
        }
        return;
      }

      if (cookiePromptModalState.isOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeCookiePromptModal();
        }
        return;
      }

      if (!viewerState.isOpen) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousViewerImage();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextViewerImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeCookiePromptModal,
    closeDownloadModal,
    closeViewer,
    cookiePromptModalState.isOpen,
    downloadModalState.isOpen,
    showNextViewerImage,
    showPreviousViewerImage,
    viewerState.isOpen,
  ]);

  const pageView =
    pageType === "lists" ? (
      <div className="dashboardScreen">
        <ListsDashboard
          sessionState={sessionState}
          onOpenThread={openLinkInNewTab}
          onOpenThreadInBackground={openLinkInBackground}
          onOpenImageViewer={openViewer}
          tagsMap={tagsMap}
          prefixesMap={prefixesMap}
          moveLinkToList={handleMoveLinkToList}
          togglePlayedFavoriteLink={togglePlayedFavoriteLink}
          togglePlayedDislikedLink={togglePlayedDislikedLink}
          toggleBookmarkedDownloadedLink={toggleBookmarkedDownloadedLink}
          removeLinkFromList={removeLinkFromList}
          pickCoverForLink={pickCoverForLink}
          pickTitleForLink={pickTitleForLink}
          pickCreatorForLink={pickCreatorForLink}
          pickRatingForLink={pickRatingForLink}
        />
      </div>
    ) : pageType === "dashboard" ? (
      <div className="dashboardScreen">
        <DashboardOverview
          sessionState={sessionState}
          tagsMap={tagsMap}
          prefixesMap={prefixesMap}
        />
      </div>
    ) : pageType === "settings" ? (
      <SettingsPage
        preferredDownloadHosts={preferredDownloadHosts}
        disabledDownloadHosts={disabledDownloadHosts}
        hiddenDownloadHosts={hiddenDownloadHosts}
        knownDownloadHosts={knownDownloadHosts}
        tagsCount={Object.keys(tagsMap).length}
        prefixesCount={Object.keys(prefixesMap).length}
        metadataSyncState={metadataSyncState}
        bundledDefaultFiltersStatus={bundledDefaultFiltersStatus}
        currentFilterState={sessionState.filterState}
        defaultFilterState={defaultFilterState}
        defaultLatestGamesSort={defaultLatestGamesSort}
        tagsMap={tagsMap}
        prefixesMap={prefixesMap}
        onStartMetadataSync={handleManualMetadataSync}
        onPauseMetadataSync={handlePauseMetadataSync}
        onResumeMetadataSync={handleResumeMetadataSync}
        onStopMetadataSync={handleStopMetadataSync}
        onUpdateDefaultFilterState={updateDefaultFilterState}
        onUpdateDefaultLatestGamesSort={updateDefaultLatestGamesSort}
        onResetDefaultFilterState={resetDefaultFilterState}
        onImportBundledDefaultFilterState={() => {
          void handleImportBundledDefaultFilterState();
        }}
        onSaveCurrentFiltersAsDefault={saveCurrentFilterStateAsDefault}
        onApplyDefaultFiltersToSwipe={applyDefaultFilterStateToSwipe}
        onMoveDownloadHost={handleMoveDownloadHost}
        onDisableDownloadHostTemporarily={handleDisableDownloadHostTemporarily}
        onEnableDownloadHost={handleEnableDownloadHost}
        onShowDownloadHost={handleShowDownloadHost}
        onResetPreferredDownloadHosts={handleResetPreferredDownloadHosts}
        onClearDisabledDownloadHosts={handleClearDisabledDownloadHosts}
        onClearHiddenDownloadHosts={handleClearHiddenDownloadHosts}
        onImportBundledTagsMap={() => {
          void handleImportBundledTagsMap();
        }}
        onOpenImportTagsMap={() => importTagsMapInputRef.current?.click()}
        onImportTagsMapChange={() => {
          void handleImportTagsMapChange();
        }}
        onImportBundledPrefixesMap={() => {
          void handleImportBundledPrefixesMap();
        }}
        onOpenImportPrefixesMap={() => importPrefixesMapInputRef.current?.click()}
        onImportPrefixesMapChange={() => {
          void handleImportPrefixesMapChange();
        }}
        onExportAllBackup={() => {
          void handleExportAllBackup();
        }}
        onExportSettingsBackup={() => {
          void handleExportSettingsBackup();
        }}
        onExportListsBackup={handleExportListsBackup}
        onOpenImportAllBackup={() => importAllBackupInputRef.current?.click()}
        onImportAllBackupChange={() => {
          void handleImportAllBackupChange();
        }}
        onOpenImportSettingsBackup={() =>
          importSettingsBackupInputRef.current?.click()
        }
        onImportSettingsBackupChange={() => {
          void handleImportSettingsBackupChange();
        }}
        onOpenImportListsBackup={() => importListsBackupInputRef.current?.click()}
        onImportListsBackupChange={() => {
          void handleImportListsBackupChange();
        }}
        onOpenGameFolders={handleOpenGameFolders}
        localDataFiles={localDataFiles}
        onOpenLocalDataFiles={handleOpenLocalDataFiles}
        onClearGameFolders={handleClearGameFolders}
        onClearAllLocalData={handleConfirmClearAllLocalData}
        onResetLocalSettings={handleConfirmResetLocalSettings}
        onClearDashboardLists={handleConfirmClearDashboardLists}
        isLauncherAvailable={isLauncherAvailable}
        libraryRootPath={libraryRootPath}
        importAllBackupInputRef={importAllBackupInputRef}
        importSettingsBackupInputRef={importSettingsBackupInputRef}
        importListsBackupInputRef={importListsBackupInputRef}
        importTagsMapInputRef={importTagsMapInputRef}
        importPrefixesMapInputRef={importPrefixesMapInputRef}
        requestedTab={requestedSettingsTab}
      />
    ) : (
      <SwipePage
        sessionState={sessionState}
        orderedSwipeThreadIdentifiers={orderedSwipeThreadIdentifiers}
        currentThreadIdentifier={currentThreadIdentifier}
        currentThreadItem={currentThreadItem}
        currentThreadLink={currentThreadLink}
        isLoadingPage={isLoadingPage}
        canUndo={canUndo}
        metadataSyncState={metadataSyncState}
        tagsMap={tagsMap}
        prefixesMap={prefixesMap}
        defaultFilterState={defaultFilterState}
        defaultLatestGamesSort={defaultLatestGamesSort}
        updateFilterState={updateFilterState}
        setLatestGamesSort={setLatestGamesSort}
        setSwipeSortMode={setSwipeSortMode}
        resetFilterState={resetFilterState}
        undoLastAction={undoLastAction}
        setErrorMessage={setErrorMessage}
        onFavorite={handleFavorite}
        onTrash={handleTrash}
        onPlayed={handlePlayed}
        onPlayedFavorite={handlePlayedFavorite}
        onOpenViewer={openViewer}
        onOpenCurrentThread={openCurrentThreadPage}
        onOpenCurrentThreadInBackground={openCurrentThreadPageInBackground}
        onPauseMetadataSync={handlePauseMetadataSync}
        onResumeMetadataSync={handleResumeMetadataSync}
        onStopMetadataSync={handleStopMetadataSync}
        isViewerOpen={viewerState.isOpen}
        isDownloadModalOpen={downloadModalState.isOpen}
        isCookiePromptOpen={cookiePromptModalState.isOpen}
      />
    );

  return (
    <div className="appRoot">
      <StartupSplash
        isVisible={isStartupSplashVisible}
        isBusy={shouldKeepStartupSplashVisible}
        statusText={startupSplashStatusText}
        metaText={startupSplashMetaText}
        progressPercent={startupSplashProgressPercent}
        catalogCount={startupCatalogCount}
      />

      <AppTopBar
        pageType={pageType}
        errorMessage={errorMessage}
        cookieRefreshNoticeMessage={cookieRefreshNoticeMessage}
        onSetPage={setPage}
      />

      {pageView}

      <CookiePromptModal
        isOpen={cookiePromptModalState.isOpen}
        threadTitle={cookiePromptModalState.threadTitle}
        draft={cookiePromptModalState.draft}
        status={cookiePromptModalState.status}
        errorMessage={cookiePromptModalState.errorMessage}
        isBusy={isCookiePromptBusy}
        onChangeDraft={setCookiePromptDraft}
        onClose={closeCookiePromptModal}
        onOpenSettings={openCookieSettingsPage}
        onSave={() => {
          void handleSaveCookiePrompt();
        }}
      />

      <ImageViewerOverlay
        viewerState={viewerState}
        onClose={closeViewer}
        onPrevious={showPreviousViewerImage}
        onNext={showNextViewerImage}
      />
    </div>
  );
};

export { App };
