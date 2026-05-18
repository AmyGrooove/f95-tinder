import { useCallback, useEffect, useMemo, useState } from "react"
import { buildThreadLink, isLikelyCookieRefreshErrorMessage } from "./f95/api"
import { useF95Browser } from "./f95/useF95Browser"
import type { ListType } from "./f95/types"
import { Dashboard as ListsDashboard } from "./components/Dashboard"
import { DashboardOverview } from "./components/DashboardOverview"
import { SettingsPage } from "./components/SettingsPage"
import { AppTopBar } from "./components/AppTopBar"
import { ImageViewerOverlay } from "./components/ImageViewerOverlay"
import { StartupSplash } from "./components/StartupSplash"
import { SwipePage } from "./components/SwipePage"
import { openLinkInBackground, openLinkInNewTab } from "./app/linking"
import {
  pickCoverForLink,
  pickCreatorForLink,
  pickRatingForLink,
  pickTitleForLink,
} from "./app/threadSelectors"
import { useAppDataActions } from "./hooks/useAppDataActions"
import { useHashNavigation } from "./hooks/useHashNavigation"
import { useImageViewer } from "./hooks/useImageViewer"

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
    clearMetadataCatalogData,
    moveLinkToList,
    togglePlayedFavoriteLink,
    togglePlayedDislikedLink,
    toggleBookmarkedDownloadedLink,
    removeLinkFromList,
  } = useF95Browser()
  const { pageType, requestedSettingsTab, setPage } = useHashNavigation()

  const [isStartupSplashVisible, setIsStartupSplashVisible] = useState(true)
  const [isStartupSplashDismissed, setIsStartupSplashDismissed] =
    useState(false)
  const {
    closeViewer,
    openViewer,
    showNextViewerImage,
    showPreviousViewerImage,
    viewerState,
  } = useImageViewer()

  const currentThreadLink = useMemo(() => {
    if (currentThreadIdentifier === null) {
      return null
    }
    return buildThreadLink(currentThreadIdentifier)
  }, [currentThreadIdentifier])

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
    replaceDefaultSwipeSettings,
    updateTagsMap,
    updatePrefixesMap,
    clearDashboardLists,
    setErrorMessage,
  })

  const isSwipeInteractionLocked =
    metadataSyncState.isRunning &&
    !metadataSyncState.isPaused &&
    metadataSyncState.swipableCount < 20

  const handleFavorite = useCallback(() => {
    if (isSwipeInteractionLocked) {
      return
    }
    applyActionToCurrentCard("favorite")
  }, [applyActionToCurrentCard, isSwipeInteractionLocked])

  const handleTrash = useCallback(() => {
    if (isSwipeInteractionLocked) {
      return
    }
    applyActionToCurrentCard("trash")
  }, [applyActionToCurrentCard, isSwipeInteractionLocked])

  const handlePlayed = useCallback(() => {
    if (isSwipeInteractionLocked) {
      return
    }
    applyActionToCurrentCard("played")
  }, [applyActionToCurrentCard, isSwipeInteractionLocked])

  const handlePlayedFavorite = useCallback(() => {
    if (isSwipeInteractionLocked) {
      return
    }
    applyActionToCurrentCard("playedFavorite")
  }, [applyActionToCurrentCard, isSwipeInteractionLocked])

  const handleManualMetadataSync = useCallback(() => {
    void startMetadataSync({ restartFromScratch: true })
  }, [startMetadataSync])

  const handlePauseMetadataSync = useCallback(() => {
    pauseMetadataSync()
  }, [pauseMetadataSync])

  const handleResumeMetadataSync = useCallback(() => {
    resumeMetadataSync()
  }, [resumeMetadataSync])

  const handleStopMetadataSync = useCallback(() => {
    stopMetadataSync()
  }, [stopMetadataSync])

  const handleClearMetadataCatalogData = useCallback(() => {
    clearMetadataCatalogData()
  }, [clearMetadataCatalogData])

  const handleMoveLinkToList = useCallback(
    (threadLink: string, listType: ListType) => {
      moveLinkToList(threadLink, listType)
    },
    [moveLinkToList],
  )

  const openCurrentThreadPage = useCallback(() => {
    if (currentThreadLink) {
      openLinkInNewTab(currentThreadLink)
    }
  }, [currentThreadLink])

  const openCurrentThreadPageInBackground = useCallback(() => {
    if (currentThreadLink) {
      openLinkInBackground(currentThreadLink)
    }
  }, [currentThreadLink])

  const startupCatalogCount = Object.keys(
    sessionState.threadItemsByIdentifier,
  ).length
  const hasStartupCatalogData = startupCatalogCount > 0
  const hasInlineStartupRetryWait =
    metadataSyncState.isRunning &&
    metadataSyncState.phase === "retrying" &&
    metadataSyncState.nextRetryAtUnixMs !== null
  const hasPendingStartupRetry =
    metadataSyncState.nextRetryAtUnixMs !== null && !hasStartupCatalogData
  const canDismissStartupSplash =
    Boolean(metadataSyncState.error) ||
    metadataSyncState.phase === "failed" ||
    hasPendingStartupRetry ||
    hasStartupCatalogData ||
    metadataSyncState.swipableCount > 0
  const shouldKeepStartupSplashVisible =
    isLoadingPage ||
    ((metadataSyncState.isRunning || hasPendingStartupRetry) &&
      metadataSyncState.swipableCount < 20 &&
      !currentThreadItem)
  const startupSplashProgressPercent = metadataSyncState.isRunning
    ? metadataSyncState.pageLimit > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              (metadataSyncState.currentPage / metadataSyncState.pageLimit) *
                100,
            ),
          ),
        )
      : null
    : hasStartupCatalogData
      ? 100
      : null
  const startupSplashStatusText = metadataSyncState.error
    ? "Стартовая синхронизация не удалась"
    : metadataSyncState.isStopping
      ? "Завершаю стартовую синхронизацию..."
      : metadataSyncState.isPaused
        ? "Стартовая синхронизация на паузе"
        : hasInlineStartupRetryWait
          ? "Жду окно для повторного запроса к latest"
          : metadataSyncState.isRunning
            ? metadataSyncState.swipableCount < 20
              ? "Собираю первые карточки latest"
              : "Каталог обновляется в фоне"
            : hasPendingStartupRetry
              ? "Жду автоповтор стартовой синхронизации"
              : hasStartupCatalogData
                ? "Локальный каталог готов"
                : "Поднимаю локальные данные"
  const startupSplashMetaText = metadataSyncState.error
    ? `${metadataSyncState.error}. Можно скрыть это окно и продолжить пользоваться приложением.`
    : hasInlineStartupRetryWait
      ? "Сервер временно ограничил запросы. Следующая попытка будет запущена автоматически."
      : metadataSyncState.isRunning
        ? `Страница ${metadataSyncState.currentPage || 0}${
            metadataSyncState.pageLimit > 0
              ? ` из ${metadataSyncState.pageLimit}`
              : ""
          } • Для свайпа: ${metadataSyncState.swipableCount}/20 • Сохранено игр: ${metadataSyncState.syncedCount}`
        : hasPendingStartupRetry
          ? "Сервер временно ограничил запросы. Приложение продолжит синхронизацию автоматически."
          : hasStartupCatalogData
            ? `Загружено из локального каталога: ${startupCatalogCount}`
            : "Читаю списки, настройки и стартовый каталог."

  const handleDismissStartupSplash = useCallback(() => {
    setIsStartupSplashDismissed(true)
  }, [])

  useEffect(() => {
    if (!isStartupSplashVisible || shouldKeepStartupSplashVisible) {
      return
    }

    const timeoutId = window.setTimeout(
      () => {
        setIsStartupSplashVisible(false)
      },
      hasStartupCatalogData ? 420 : 180,
    )

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    hasStartupCatalogData,
    currentThreadItem,
    isStartupSplashVisible,
    shouldKeepStartupSplashVisible,
  ])

  const cookieRefreshNoticeMessage = useMemo(() => {
    if (!isLikelyCookieRefreshErrorMessage(metadataSyncState.error)) {
      return null
    }

    return "Не удалось проверить обновления. Похоже, F95 не принял текущие куки. Обнови их во вкладке Куки."
  }, [metadataSyncState.error])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!viewerState.isOpen) {
        return
      }

      if (event.key === "Escape") {
        event.preventDefault()
        closeViewer()
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        showPreviousViewerImage()
        return
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        showNextViewerImage()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    closeViewer,
    showNextViewerImage,
    showPreviousViewerImage,
    viewerState.isOpen,
  ])

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
        onClearMetadataCatalogData={handleClearMetadataCatalogData}
        onUpdateDefaultFilterState={updateDefaultFilterState}
        onUpdateDefaultLatestGamesSort={updateDefaultLatestGamesSort}
        onResetDefaultFilterState={resetDefaultFilterState}
        onImportBundledDefaultFilterState={() => {
          void handleImportBundledDefaultFilterState()
        }}
        onSaveCurrentFiltersAsDefault={saveCurrentFilterStateAsDefault}
        onApplyDefaultFiltersToSwipe={applyDefaultFilterStateToSwipe}
        onImportBundledTagsMap={() => {
          void handleImportBundledTagsMap()
        }}
        onOpenImportTagsMap={() => importTagsMapInputRef.current?.click()}
        onImportTagsMapChange={() => {
          void handleImportTagsMapChange()
        }}
        onImportBundledPrefixesMap={() => {
          void handleImportBundledPrefixesMap()
        }}
        onOpenImportPrefixesMap={() =>
          importPrefixesMapInputRef.current?.click()
        }
        onImportPrefixesMapChange={() => {
          void handleImportPrefixesMapChange()
        }}
        onExportAllBackup={() => {
          void handleExportAllBackup()
        }}
        onExportSettingsBackup={() => {
          void handleExportSettingsBackup()
        }}
        onExportListsBackup={handleExportListsBackup}
        onOpenImportAllBackup={() => importAllBackupInputRef.current?.click()}
        onImportAllBackupChange={() => {
          void handleImportAllBackupChange()
        }}
        onOpenImportSettingsBackup={() =>
          importSettingsBackupInputRef.current?.click()
        }
        onImportSettingsBackupChange={() => {
          void handleImportSettingsBackupChange()
        }}
        onOpenImportListsBackup={() =>
          importListsBackupInputRef.current?.click()
        }
        onImportListsBackupChange={() => {
          void handleImportListsBackupChange()
        }}
        localDataFiles={localDataFiles}
        onOpenLocalDataFiles={handleOpenLocalDataFiles}
        onClearAllLocalData={handleConfirmClearAllLocalData}
        onResetLocalSettings={handleConfirmResetLocalSettings}
        onClearDashboardLists={handleConfirmClearDashboardLists}
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
      />
    )

  return (
    <div className="appRoot">
      <StartupSplash
        isVisible={isStartupSplashVisible && !isStartupSplashDismissed}
        isBusy={shouldKeepStartupSplashVisible}
        statusText={startupSplashStatusText}
        metaText={startupSplashMetaText}
        progressPercent={startupSplashProgressPercent}
        catalogCount={startupCatalogCount}
        canDismiss={canDismissStartupSplash}
        onDismiss={handleDismissStartupSplash}
      />

      <AppTopBar
        pageType={pageType}
        errorMessage={errorMessage}
        cookieRefreshNoticeMessage={cookieRefreshNoticeMessage}
        onSetPage={setPage}
      />

      {pageView}

      <ImageViewerOverlay
        viewerState={viewerState}
        onClose={closeViewer}
        onPrevious={showPreviousViewerImage}
        onNext={showNextViewerImage}
      />
    </div>
  )
}

export { App }
