import {
  findBestDownloadLink,
  isDownloadHostHidden,
  isSupportedDownloadHost,
  SUPPORTED_DOWNLOAD_HOSTS,
  shouldHideDownloadGroup,
} from "../f95/downloads";
import type { ThreadDownloadsData } from "../f95/types";

const formatHiddenGroupsSummary = (count: number) => {
  const remainder10 = count % 10;
  const remainder100 = count % 100;

  if (remainder10 === 1 && remainder100 !== 11) {
    return `Скрыта ${count} платформенная секция`;
  }

  if (
    remainder10 >= 2 &&
    remainder10 <= 4 &&
    (remainder100 < 12 || remainder100 > 14)
  ) {
    return `Скрыто ${count} платформенные секции`;
  }

  return `Скрыто ${count} платформенных секций`;
};

type VisibleDownloadGroup = {
  label: string;
  contextLabel: string | null;
  links: ThreadDownloadsData["groups"][number]["links"];
};

const buildVisibleGroups = (
  downloadsData: ThreadDownloadsData | null,
  hiddenDownloadHosts: string[],
) => {
  const visibleGroups: VisibleDownloadGroup[] = [];
  const hiddenGroupLabels = new Set<string>();
  let pendingContextLabel: string | null = null;

  for (const group of downloadsData?.groups ?? []) {
    const visibleLinks = group.links.filter(
      (link) =>
        isSupportedDownloadHost(link.label) &&
        !isDownloadHostHidden(link.label, hiddenDownloadHosts),
    );
    const hasLinks = visibleLinks.length > 0;

    if (group.links.length === 0) {
      pendingContextLabel = group.label;
      continue;
    }

    if (!hasLinks) {
      continue;
    }

    if (shouldHideDownloadGroup(group.label)) {
      hiddenGroupLabels.add(group.label);
      continue;
    }

    visibleGroups.push({
      label: group.label,
      contextLabel: pendingContextLabel,
      links: visibleLinks,
    });
    pendingContextLabel = null;
  }

  return {
    visibleGroups,
    hiddenGroupLabels: Array.from(hiddenGroupLabels),
  };
};

type DownloadModalProps = {
  isOpen: boolean;
  threadLink: string | null;
  threadTitle: string;
  isLoading: boolean;
  errorMessage: string | null;
  downloadsData: ThreadDownloadsData | null;
  preferredDownloadHosts: string[];
  disabledDownloadHosts: Record<string, number>;
  hiddenDownloadHosts: string[];
  primaryActionLabel?: string;
  isPrimaryActionDisabled?: boolean;
  onClose: () => void;
  onOpenBestDownload: (threadLink: string, threadTitle: string) => void;
  onOpenSettings: () => void;
  onOpenThread: (threadLink: string) => void;
};

const renderStateText = (downloadsData: ThreadDownloadsData | null) => {
  if (!downloadsData) {
    return "Нет данных";
  }

  if (downloadsData.status === "available") {
    return "Ссылки готовы";
  }

  if (downloadsData.status === "login_required") {
    return "F95 скрывает реальные ссылки для гостей";
  }

  return "Блок DOWNLOAD не найден";
};

const DownloadModal = ({
  isOpen,
  threadLink,
  threadTitle,
  isLoading,
  errorMessage,
  downloadsData,
  preferredDownloadHosts,
  disabledDownloadHosts,
  hiddenDownloadHosts,
  primaryActionLabel = "Скачать лучший",
  isPrimaryActionDisabled = false,
  onClose,
  onOpenBestDownload,
  onOpenSettings,
  onOpenThread,
}: DownloadModalProps) => {
  if (!isOpen) {
    return null;
  }

  const supportedHostsLabel = SUPPORTED_DOWNLOAD_HOSTS.join(", ");
  const shouldShowLoginHint =
    downloadsData?.status === "login_required" ||
    (downloadsData?.requiresAuth ?? false);
  const { visibleGroups, hiddenGroupLabels } = buildVisibleGroups(
    downloadsData,
    hiddenDownloadHosts,
  );
  const bestAvailableDownloadLink = downloadsData
    ? findBestDownloadLink(
        downloadsData,
        preferredDownloadHosts,
        disabledDownloadHosts,
        hiddenDownloadHosts,
      )
    : null;

  return (
    <div
      className="downloadModalOverlay"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div className="downloadModal">
        <div className="downloadModalHeader">
          <div className="downloadModalTitleWrap">
            <div className="downloadModalTitle">Загрузки</div>
            <div className="smallText">{threadTitle}</div>
            {threadLink ? (
              <div className="downloadModalMeta">{threadLink}</div>
            ) : null}
            <div className="smallText">
              Статус: {isLoading ? "загрузка..." : renderStateText(downloadsData)}
            </div>
          </div>

          <div className="downloadModalActions">
            {threadLink ? (
              <button
                className="button buttonPrimary"
                type="button"
                onClick={() => onOpenBestDownload(threadLink, threadTitle)}
                disabled={isPrimaryActionDisabled}
              >
                {primaryActionLabel}
              </button>
            ) : null}
            {threadLink ? (
              <button className="button" type="button" onClick={onOpenSettings}>
                Настройки
              </button>
            ) : null}
            {threadLink ? (
              <button
                className="button"
                type="button"
                onClick={() => onOpenThread(threadLink)}
              >
                Открыть тред
              </button>
            ) : null}
            <button className="button" type="button" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>

        <div className="downloadModalBody">
          {errorMessage ? (
            <div className="downloadEmptyState">{errorMessage}</div>
          ) : null}

          {shouldShowLoginHint ? (
            <div className="downloadNotice">
              Как гость приложение видит только названия mirrors из текста треда.
              Чтобы кнопки стали кликабельными, добавь куки через вкладку
              `Куки` в настройках или задай `F95_COOKIE` в `.env`.
            </div>
          ) : null}

          {isLoading ? (
            <div className="downloadEmptyState">Загружаю блок DOWNLOAD...</div>
          ) : null}

          {!isLoading && !errorMessage && downloadsData ? (
            <div className="downloadQuickSummary">
              <div className="downloadQuickSummaryLabel">One-click</div>
              <div className="downloadQuickSummaryValue">
                {bestAvailableDownloadLink?.label
                  ? `Сейчас выберет ${bestAvailableDownloadLink.label}`
                  : `Сейчас нет поддерживаемого host'а. Доступны только ${supportedHostsLabel}`}
              </div>
              <div className="downloadQuickSummaryMeta">
                One-click работает только с {supportedHostsLabel}. Порядок и
                временная пауза настраиваются отдельно.
              </div>
            </div>
          ) : null}

          {!isLoading &&
          !errorMessage &&
          downloadsData?.groups.length === 0 ? (
            <div className="downloadEmptyState">
              Для этой карточки не удалось найти отдельный блок загрузок.
            </div>
          ) : null}

          {!isLoading &&
          !errorMessage &&
          downloadsData &&
          downloadsData.groups.length > 0 &&
          visibleGroups.length === 0 ? (
            <div className="downloadEmptyState">
              В этом треде не найдено поддерживаемых host'ов или они скрыты
              настройками. Сейчас поддерживаются только {supportedHostsLabel}.
            </div>
          ) : null}

          {!isLoading && !errorMessage
            ? visibleGroups.map((group) => (
                <div key={group.label} className="downloadGroup">
                  <div className="downloadGroupHeader">
                    {group.contextLabel ? (
                      <div className="downloadGroupContext">
                        {group.contextLabel}
                      </div>
                    ) : null}
                    <div className="downloadGroupLabel">{group.label}</div>
                  </div>
                  <div className="downloadLinksGrid">
                    {group.links.map((link) =>
                      link.url ? (
                        <a
                          key={`${group.label}-${link.label}-${link.url}`}
                          className="downloadLinkButton"
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={
                            link.isMasked
                              ? "Откроет masked link на F95Zone"
                              : link.label
                          }
                        >
                          {link.label}
                        </a>
                      ) : (
                        <button
                          key={`${group.label}-${link.label}`}
                          className="downloadLinkButton downloadLinkButtonDisabled"
                          type="button"
                          disabled
                          title="Ссылка скрыта для гостя"
                        >
                          {link.label}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ))
            : null}

          {!isLoading && !errorMessage && hiddenGroupLabels.length > 0 ? (
            <details className="downloadHiddenGroups">
              <summary className="downloadHiddenGroupsSummary">
                {formatHiddenGroupsSummary(hiddenGroupLabels.length)}
              </summary>
              <div className="downloadHiddenGroupsBody">
                {hiddenGroupLabels.join(", ")}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export { DownloadModal };
