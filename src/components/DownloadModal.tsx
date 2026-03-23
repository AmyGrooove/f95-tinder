import {
  collectDownloadChoices,
  collectPreferredDownloadLinksFromLinks,
  findBestDownloadLink,
  getDownloadLinkHostLabel,
  SUPPORTED_DOWNLOAD_HOSTS,
} from "../f95/downloads";
import type { DownloadLink, ThreadDownloadsData } from "../f95/types";

type VisibleDownloadChoice = {
  key: string;
  label: string;
  contextLabel: string | null;
  links: DownloadLink[];
  autoDownloadLinks: DownloadLink[];
  hostLabelList: string[];
};

const buildVisibleChoices = (
  downloadsData: ThreadDownloadsData | null,
  preferredDownloadHosts: string[],
  disabledDownloadHosts: Record<string, number>,
  hiddenDownloadHosts: string[],
) => {
  if (!downloadsData) {
    return [];
  }

  return collectDownloadChoices(downloadsData).map((choice) => {
    const autoDownloadLinks = collectPreferredDownloadLinksFromLinks(
      choice.links,
      preferredDownloadHosts,
      disabledDownloadHosts,
      hiddenDownloadHosts,
    );
    const hostLabelList = choice.links
      .map((link) => getDownloadLinkHostLabel(link) || link.label)
      .filter((label, index, array) => label.length > 0 && array.indexOf(label) === index);

    return {
      ...choice,
      autoDownloadLinks,
      hostLabelList,
    };
  });
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
  onOpenDownloadChoice: (
    threadLink: string,
    threadTitle: string,
    linkList: DownloadLink[],
  ) => void;
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
  onOpenDownloadChoice,
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
  const visibleChoices = buildVisibleChoices(
    downloadsData,
    preferredDownloadHosts,
    disabledDownloadHosts,
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
  const shouldShowPrimaryAction =
    Boolean(threadLink) &&
    visibleChoices.length <= 1 &&
    Boolean(bestAvailableDownloadLink?.url);

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
            {threadLink && shouldShowPrimaryAction ? (
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
                {visibleChoices.length > 1
                  ? `Найдено ${visibleChoices.length} варианта. Выбери, что скачивать.`
                  : bestAvailableDownloadLink?.label
                    ? `Готово к скачиванию через ${bestAvailableDownloadLink.label}`
                    : visibleChoices.length === 1
                      ? "Есть ссылки, но auto one-click не нашел поддерживаемый host."
                      : `Сейчас нет подходящих зеркал. Доступны auto-host'ы: ${supportedHostsLabel}`}
              </div>
              <div className="downloadQuickSummaryMeta">
                One-click работает только с {supportedHostsLabel}. Если host
                не подходит, приложение попробует следующий внутри выбранного
                варианта.
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
          visibleChoices.length === 0 ? (
            <div className="downloadEmptyState">
              В треде не осталось прямых или masked зеркал для скачивания.
              Открой страницу треда и скачай вручную.
            </div>
          ) : null}

          {!isLoading && !errorMessage
            ? visibleChoices.map((choice) => (
                <div key={choice.key} className="downloadGroup">
                  <div className="downloadGroupHeader">
                    {choice.contextLabel ? (
                      <div className="downloadGroupContext">
                        {choice.contextLabel}
                      </div>
                    ) : null}
                    <div className="downloadGroupLabel">{choice.label}</div>
                    {choice.hostLabelList.length > 0 ? (
                      <div className="downloadLinksGrid">
                        {choice.hostLabelList.map((hostLabel) => (
                          <span
                            key={`${choice.key}-${hostLabel}`}
                            className="downloadLinkButton downloadLinkButtonHost"
                          >
                            {hostLabel}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {threadLink && choice.autoDownloadLinks.length > 0 ? (
                    <div className="downloadChoiceActions">
                      <button
                        className="button buttonPrimary"
                        type="button"
                        onClick={() =>
                          onOpenDownloadChoice(threadLink, threadTitle, choice.links)
                        }
                        disabled={isPrimaryActionDisabled}
                      >
                        Скачать этот вариант
                      </button>
                    </div>
                  ) : (
                    <div className="downloadQuickSummaryMeta">
                      Для этого варианта автоматическое скачивание сейчас
                      недоступно. Можно открыть ссылки вручную.
                    </div>
                  )}
                  <div className="downloadLinksGrid">
                    {choice.links.map((link) =>
                      link.url ? (
                        <a
                          key={`${choice.key}-${link.label}-${link.url}`}
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
                          key={`${choice.key}-${link.label}`}
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
        </div>
      </div>
    </div>
  );
};

export { DownloadModal };
