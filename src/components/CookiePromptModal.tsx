import type { CookieProxyStatus } from "../f95/cookieProxy";

type CookiePromptModalProps = {
  isOpen: boolean;
  threadTitle: string;
  draft: string;
  status: CookieProxyStatus | null;
  errorMessage: string | null;
  isBusy: boolean;
  onChangeDraft: (value: string) => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onSave: () => void;
};

const CookiePromptModal = ({
  isOpen,
  threadTitle,
  draft,
  status,
  errorMessage,
  isBusy,
  onChangeDraft,
  onClose,
  onOpenSettings,
  onSave,
}: CookiePromptModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="downloadModalOverlay"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isBusy) {
          onClose();
        }
      }}
    >
      <div className="downloadModal">
        <div className="downloadModalHeader">
          <div className="downloadModalTitleWrap">
            <div className="downloadModalTitle">Нужны куки F95</div>
            <div className="smallText">
              Для доступа к `{threadTitle}` через F95 приложению нужны куки.
            </div>
          </div>

          <div className="downloadModalActions">
            <button
              className="button buttonPrimary"
              type="button"
              onClick={onSave}
              disabled={isBusy || draft.trim().length === 0}
            >
              Сохранить
            </button>
            <button
              className="button"
              type="button"
              onClick={onOpenSettings}
              disabled={isBusy}
            >
              Открыть Куки
            </button>
            <button className="button" type="button" onClick={onClose} disabled={isBusy}>
              Закрыть
            </button>
          </div>
        </div>

        <div className="downloadModalBody">
          <div className="downloadNotice">
            Вставь `F95_COOKIE="..."`, `cookies.txt`, JSON или таблицу из
            DevTools. После сохранения приложение сразу начнет использовать эти куки.
          </div>

          <div className="settingsSummaryGrid settingsCookieStatusGrid">
            <div className="metricCard">
              <div className="metricLabel">Статус</div>
              <div className="metricValue settingsMetricValue">
                {status?.configured ? "Активен" : "Не задан"}
              </div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Источник</div>
              <div className="metricValue settingsMetricValue">
                {status?.source === "settings"
                  ? "Вкладка"
                  : status?.source === "env"
                    ? ".env"
                    : "Нет"}
              </div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Найдено cookies</div>
              <div className="metricValue settingsMetricValue">
                {status?.cookieNames.length ?? 0}
              </div>
            </div>
            <div className="metricCard">
              <div className="metricLabel">Не хватает</div>
              <div className="metricValue settingsMetricValue">
                {status?.missingRecommendedCookieNames.length ?? 3}
              </div>
            </div>
          </div>

          {status?.missingRecommendedCookieNames.length ? (
            <div className="smallText settingsCookieWarning">
              Не найдены рекомендуемые cookies:{" "}
              {status.missingRecommendedCookieNames.join(", ")}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="downloadEmptyState">{errorMessage}</div>
          ) : null}

          <textarea
            className="input settingsCookieTextarea"
            value={draft}
            onChange={(event) => onChangeDraft(event.target.value)}
            placeholder={`F95_COOKIE="xf_user=...; xf_session=...; xf_csrf=..."`}
            rows={10}
            disabled={isBusy}
          />
        </div>
      </div>
    </div>
  );
};

export { CookiePromptModal };
