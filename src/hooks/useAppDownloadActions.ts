import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  fetchCookieProxyBackup,
  fetchCookieProxyStatus,
  saveCookieProxyInput,
} from "../f95/cookieProxy";
import {
  collectDownloadChoices,
  collectPreferredDownloadLinksFromLinks,
  findBestDownloadLink,
  loadCachedThreadDownloads,
  loadKnownDownloadHosts,
  loadOrFetchThreadDownloads,
  sortDownloadHostsByPreference,
} from "../f95/downloads";
import {
  closeBackgroundTarget,
  navigateBackgroundTarget,
  openBackgroundTarget,
  openLinkInNewTab,
} from "../app/linking";
import {
  createClosedCookiePromptModalState,
  createClosedDownloadModalState,
  createClosedViewerState,
  type BestDownloadOpenOptions,
} from "../app/downloadState";
import { isLauncherGameBusy } from "../launcher/ui";
import type {
  LauncherDownloadRequest,
  LauncherGameRecord,
  LauncherInstallFolderRequest,
} from "../launcher/types";

type UseAppDownloadActionsOptions = {
  isLauncherAvailable: boolean;
  launcherGamesByThreadLink: Record<string, LauncherGameRecord>;
  preferredDownloadHosts: string[];
  disabledDownloadHosts: Record<string, number>;
  hiddenDownloadHosts: string[];
  setErrorMessage: Dispatch<SetStateAction<string | null>>;
  downloadGame: (request: LauncherDownloadRequest) => Promise<unknown>;
  cancelDownloadGame: (threadLink: string) => Promise<unknown>;
  clearLibrary: () => Promise<unknown>;
  chooseInstallFolder: (
    request: LauncherInstallFolderRequest,
  ) => Promise<unknown>;
  chooseLaunchTarget: (threadLink: string) => Promise<unknown>;
  deleteGameFiles: (threadLink: string) => Promise<unknown>;
  launchGame: (threadLink: string) => Promise<unknown>;
  openLibraryFolder: () => Promise<unknown>;
  openMirrorForGame: (threadLink: string) => Promise<unknown>;
};

const useAppDownloadActions = ({
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
}: UseAppDownloadActionsOptions) => {
  const [viewerState, setViewerState] = useState(() => createClosedViewerState());
  const [downloadModalState, setDownloadModalState] = useState(() =>
    createClosedDownloadModalState(),
  );
  const [cookiePromptModalState, setCookiePromptModalState] = useState(() =>
    createClosedCookiePromptModalState(),
  );
  const [isCookiePromptBusy, setIsCookiePromptBusy] = useState(false);
  const downloadRequestIdRef = useRef(0);

  const openViewer = useCallback((imageUrlList: string[], startIndex: number) => {
    setViewerState({ isOpen: true, imageUrlList, activeIndex: startIndex });
  }, []);

  const closeViewer = useCallback(() => {
    setViewerState(createClosedViewerState());
  }, []);

  const showPreviousViewerImage = useCallback(() => {
    setViewerState((previousState) => {
      if (!previousState.isOpen || previousState.imageUrlList.length === 0) {
        return previousState;
      }

      const nextIndex =
        previousState.activeIndex <= 0
          ? previousState.imageUrlList.length - 1
          : previousState.activeIndex - 1;

      return { ...previousState, activeIndex: nextIndex };
    });
  }, []);

  const showNextViewerImage = useCallback(() => {
    setViewerState((previousState) => {
      if (!previousState.isOpen || previousState.imageUrlList.length === 0) {
        return previousState;
      }

      const nextIndex =
        previousState.activeIndex >= previousState.imageUrlList.length - 1
          ? 0
          : previousState.activeIndex + 1;

      return { ...previousState, activeIndex: nextIndex };
    });
  }, []);

  const closeDownloadModal = useCallback(() => {
    downloadRequestIdRef.current += 1;
    setDownloadModalState(createClosedDownloadModalState());
  }, []);

  const closeCookiePromptModal = useCallback(() => {
    setCookiePromptModalState(createClosedCookiePromptModalState());
    setIsCookiePromptBusy(false);
  }, []);

  const setCookiePromptDraft = useCallback((value: string) => {
    setCookiePromptModalState((previousState) => ({
      ...previousState,
      draft: value,
    }));
  }, []);

  const promptForCookiesBeforeDownload = useCallback(
    async (
      threadLink: string,
      threadTitle: string,
      errorMessageValue: string | null = null,
    ) => {
      let cookieStatus = null;
      let cookieDraft = "";

      try {
        cookieStatus = await fetchCookieProxyStatus();
      } catch {
        cookieStatus = null;
      }

      try {
        const cookieBackup = await fetchCookieProxyBackup();
        if (cookieBackup?.source === "settings" && cookieBackup.text) {
          cookieDraft = cookieBackup.text;
        }
      } catch {
        cookieDraft = "";
      }

      setCookiePromptModalState({
        isOpen: true,
        threadLink,
        threadTitle,
        draft: cookieDraft,
        status: cookieStatus,
        errorMessage: errorMessageValue,
      });
    },
    [],
  );

  const ensureCookiesBeforeDownload = useCallback(
    async (threadLink: string, threadTitle: string) => {
      try {
        const cookieStatus = await fetchCookieProxyStatus();
        if (cookieStatus.configured) {
          return true;
        }

        await promptForCookiesBeforeDownload(threadLink, threadTitle);
        return false;
      } catch (error) {
        await promptForCookiesBeforeDownload(
          threadLink,
          threadTitle,
          error instanceof Error
            ? error.message
            : "Не удалось проверить состояние куки. Вставь их вручную.",
        );
        return false;
      }
    },
    [promptForCookiesBeforeDownload],
  );

  const showDownloadModal = useCallback(
    (
      threadLink: string,
      threadTitle: string,
      downloadsData: typeof downloadModalState.downloadsData,
      isLoading: boolean,
      errorMessageValue: string | null,
    ) => {
      setDownloadModalState({
        isOpen: true,
        threadLink,
        threadTitle,
        downloadsData,
        isLoading,
        errorMessage: errorMessageValue,
      });
    },
    [downloadModalState.downloadsData],
  );

  const openDownloadModal = useCallback(
    async (threadLink: string, threadTitle: string) => {
      const cachedDownloads = loadCachedThreadDownloads(threadLink);
      const requestId = downloadRequestIdRef.current + 1;
      downloadRequestIdRef.current = requestId;

      if (cachedDownloads) {
        showDownloadModal(threadLink, threadTitle, cachedDownloads, false, null);
        return;
      }

      showDownloadModal(threadLink, threadTitle, null, true, null);

      try {
        const downloadsData = await loadOrFetchThreadDownloads(threadLink);

        if (downloadRequestIdRef.current !== requestId) {
          return;
        }

        showDownloadModal(threadLink, threadTitle, downloadsData, false, null);
      } catch (error) {
        if (downloadRequestIdRef.current !== requestId) {
          return;
        }

        showDownloadModal(
          threadLink,
          threadTitle,
          null,
          false,
          error instanceof Error
            ? error.message
            : "Не удалось загрузить download links",
        );
      }
    },
    [showDownloadModal],
  );

  const openBestDownloadForThread = useCallback(
    async (
      threadLink: string,
      threadTitle: string,
      options: BestDownloadOpenOptions = {},
    ) => {
      const launcherGame = launcherGamesByThreadLink[threadLink] ?? null;
      if (isLauncherAvailable) {
        if (launcherGame?.status === "installed") {
          try {
            if (!launcherGame.launchTargetPath) {
              await chooseLaunchTarget(threadLink);
              return;
            }

            await launchGame(threadLink);
          } catch (error) {
            setErrorMessage(
              error instanceof Error ? error.message : "Не удалось запустить игру",
            );
          }
          return;
        }

        if (isLauncherGameBusy(launcherGame)) {
          try {
            await cancelDownloadGame(threadLink);
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Не удалось отменить скачивание",
            );
          }
          return;
        }

        const hasCookies = await ensureCookiesBeforeDownload(threadLink, threadTitle);
        if (!hasCookies) {
          return;
        }

        try {
          const downloadsData = await loadOrFetchThreadDownloads(threadLink);
          const downloadChoiceList = collectDownloadChoices(downloadsData);
          if (downloadChoiceList.length === 0) {
            showDownloadModal(
              threadLink,
              threadTitle,
              downloadsData,
              false,
              "Не удалось найти зеркала для автоматического скачивания. Открой тред и скачай вручную.",
            );
            return;
          }

          if (!options.selectedDownloadLinks && downloadChoiceList.length > 1) {
            showDownloadModal(threadLink, threadTitle, downloadsData, false, null);
            return;
          }

          const selectedDownloadLinkList =
            options.selectedDownloadLinks ?? downloadChoiceList[0]?.links ?? [];
          const preferredDownloadLinkList = collectPreferredDownloadLinksFromLinks(
            selectedDownloadLinkList,
            preferredDownloadHosts,
            disabledDownloadHosts,
            hiddenDownloadHosts,
          );
          const bestDownloadLink = preferredDownloadLinkList[0] ?? null;

          if (bestDownloadLink?.url) {
            await downloadGame({
              threadLink,
              threadTitle,
              downloadUrl: bestDownloadLink.url,
              hostLabel: bestDownloadLink.label,
              downloadSources: preferredDownloadLinkList
                .filter((link) => typeof link.url === "string")
                .map((link) => ({
                  downloadUrl: link.url as string,
                  hostLabel: link.label,
                })),
            });
            return;
          }

          showDownloadModal(
            threadLink,
            threadTitle,
            downloadsData,
            false,
            "Для выбранного варианта нет поддерживаемого host'а. Открой тред и скачай вручную.",
          );
          return;
        } catch (error) {
          showDownloadModal(
            threadLink,
            threadTitle,
            null,
            false,
            error instanceof Error
              ? error.message
              : "Не удалось подготовить загрузку",
          );
          return;
        }
      }

      const pendingBackgroundTarget = options.openInBackground
        ? openBackgroundTarget()
        : null;

      try {
        const downloadsData = await loadOrFetchThreadDownloads(threadLink);
        const downloadChoiceList = collectDownloadChoices(downloadsData);
        if (downloadChoiceList.length === 0) {
          closeBackgroundTarget(pendingBackgroundTarget);
          showDownloadModal(
            threadLink,
            threadTitle,
            downloadsData,
            false,
            "Не удалось найти ссылки на скачивание. Открой тред вручную.",
          );
          return;
        }

        if (!options.selectedDownloadLinks && downloadChoiceList.length > 1) {
          closeBackgroundTarget(pendingBackgroundTarget);
          showDownloadModal(threadLink, threadTitle, downloadsData, false, null);
          return;
        }

        const selectedDownloadLinkList =
          options.selectedDownloadLinks ?? downloadChoiceList[0]?.links ?? [];
        const preferredDownloadLinkList = collectPreferredDownloadLinksFromLinks(
          selectedDownloadLinkList,
          preferredDownloadHosts,
          disabledDownloadHosts,
          hiddenDownloadHosts,
        );
        const bestDownloadLink =
          preferredDownloadLinkList[0] ??
          selectedDownloadLinkList.find((link) => typeof link.url === "string") ??
          findBestDownloadLink(
            downloadsData,
            preferredDownloadHosts,
            disabledDownloadHosts,
            hiddenDownloadHosts,
          );

        if (bestDownloadLink?.url) {
          if (options.openInBackground) {
            navigateBackgroundTarget(pendingBackgroundTarget, bestDownloadLink.url);
          } else {
            openLinkInNewTab(bestDownloadLink.url);
          }
          return;
        }

        closeBackgroundTarget(pendingBackgroundTarget);
        showDownloadModal(
          threadLink,
          threadTitle,
          downloadsData,
          false,
          "Для выбранного варианта нет прямой ссылки. Открой тред вручную.",
        );
      } catch (error) {
        closeBackgroundTarget(pendingBackgroundTarget);
        showDownloadModal(
          threadLink,
          threadTitle,
          null,
          false,
          error instanceof Error
            ? error.message
            : "Не удалось загрузить download links",
        );
      }
    },
    [
      cancelDownloadGame,
      chooseLaunchTarget,
      disabledDownloadHosts,
      downloadGame,
      ensureCookiesBeforeDownload,
      hiddenDownloadHosts,
      isLauncherAvailable,
      launchGame,
      launcherGamesByThreadLink,
      preferredDownloadHosts,
      setErrorMessage,
      showDownloadModal,
    ],
  );

  const handleOpenErrorMirrorForThread = useCallback(
    (threadLink: string, threadTitle: string) => {
      const launcherGame = launcherGamesByThreadLink[threadLink] ?? null;

      if (
        isLauncherAvailable &&
        launcherGame?.lastDownloadUrl &&
        !isLauncherGameBusy(launcherGame)
      ) {
        void openMirrorForGame(threadLink).catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось открыть зеркало для ручной загрузки",
          );
        });
        return;
      }

      void openBestDownloadForThread(threadLink, threadTitle);
    },
    [
      isLauncherAvailable,
      launcherGamesByThreadLink,
      openBestDownloadForThread,
      openMirrorForGame,
      setErrorMessage,
    ],
  );

  const handleDeleteGameFilesForThread = useCallback(
    (threadLink: string, threadTitle: string) => {
      const shouldDelete = window.confirm(
        `Удалить локальные файлы игры "${threadTitle}"? Это удалит архив и распакованную папку, но не тронет списки.`,
      );
      if (!shouldDelete) {
        return Promise.resolve();
      }

      return deleteGameFiles(threadLink)
        .catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось удалить файлы игры",
          );
          throw error;
        })
        .then(() => undefined);
    },
    [deleteGameFiles, setErrorMessage],
  );

  const handleChooseLaunchTargetForThread = useCallback(
    (threadLink: string) => {
      return chooseLaunchTarget(threadLink)
        .catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось выбрать запускатор игры",
          );
          throw error;
        })
        .then(() => undefined);
    },
    [chooseLaunchTarget, setErrorMessage],
  );

  const handleChooseInstallFolderForThread = useCallback(
    (threadLink: string, threadTitle: string) => {
      return chooseInstallFolder({ threadLink, threadTitle })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Не удалось привязать папку игры",
          );
          throw error;
        })
        .then(() => undefined);
    },
    [chooseInstallFolder, setErrorMessage],
  );

  const handleSaveCookiePrompt = useCallback(async () => {
    if (
      !cookiePromptModalState.threadLink ||
      cookiePromptModalState.draft.trim().length === 0
    ) {
      return;
    }

    const { threadLink, threadTitle, draft } = cookiePromptModalState;

    try {
      setIsCookiePromptBusy(true);
      setCookiePromptModalState((previousState) => ({
        ...previousState,
        errorMessage: null,
      }));

      const nextStatus = await saveCookieProxyInput(draft);
      if (!nextStatus.configured) {
        throw new Error("Не удалось сохранить куки.");
      }

      closeCookiePromptModal();
      await openBestDownloadForThread(threadLink, threadTitle);
    } catch (error) {
      setCookiePromptModalState((previousState) => ({
        ...previousState,
        errorMessage:
          error instanceof Error ? error.message : "Не удалось сохранить куки",
      }));
    } finally {
      setIsCookiePromptBusy(false);
    }
  }, [closeCookiePromptModal, cookiePromptModalState, openBestDownloadForThread]);

  const handleClearGameFolders = useCallback(() => {
    if (!isLauncherAvailable) {
      setErrorMessage("Очистка папок с играми доступна только в Electron-версии.");
      return;
    }

    void clearLibrary().catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось очистить папки с играми",
      );
    });
  }, [clearLibrary, isLauncherAvailable, setErrorMessage]);

  const handleOpenGameFolders = useCallback(() => {
    if (!isLauncherAvailable) {
      setErrorMessage("Открытие папки с играми доступно только в Electron-версии.");
      return;
    }

    void openLibraryFolder().catch((error) => {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Не удалось открыть папку с играми",
      );
    });
  }, [isLauncherAvailable, openLibraryFolder, setErrorMessage]);

  const knownDownloadHosts = useMemo(() => {
    return sortDownloadHostsByPreference(
      loadKnownDownloadHosts(),
      preferredDownloadHosts,
    );
  }, [
    preferredDownloadHosts,
    disabledDownloadHosts,
    hiddenDownloadHosts,
    downloadModalState.downloadsData,
  ]);

  return {
    closeCookiePromptModal,
    closeDownloadModal,
    closeViewer,
    cookiePromptModalState,
    downloadModalState,
    handleChooseInstallFolderForThread,
    handleChooseLaunchTargetForThread,
    handleClearGameFolders,
    handleDeleteGameFilesForThread,
    handleOpenErrorMirrorForThread,
    handleOpenGameFolders,
    handleSaveCookiePrompt,
    isCookiePromptBusy,
    knownDownloadHosts,
    openBestDownloadForThread,
    openDownloadModal,
    openViewer,
    setCookiePromptDraft,
    showNextViewerImage,
    showPreviousViewerImage,
    viewerState,
  };
};

export { useAppDownloadActions };
