import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  clearCookieProxyInput,
  fetchCookieProxyStatus,
  saveCookieProxyInput,
  type CookieProxyStatus,
} from "../f95/cookieProxy";
import { SyncMetadataPanel } from "./SyncMetadataPanel";
import type { MetadataSyncState } from "../f95/types";

type SettingsPageProps = {
  preferredDownloadHosts: string[];
  disabledDownloadHosts: Record<string, number>;
  hiddenDownloadHosts: string[];
  knownDownloadHosts: string[];
  tagsCount: number;
  metadataSyncState: MetadataSyncState;
  onMoveDownloadHost: (hostLabel: string, direction: -1 | 1) => void;
  onDisableDownloadHostTemporarily: (hostLabel: string) => void;
  onEnableDownloadHost: (hostLabel: string) => void;
  onHideDownloadHost: (hostLabel: string) => void;
  onShowDownloadHost: (hostLabel: string) => void;
  onResetPreferredDownloadHosts: () => void;
  onClearDisabledDownloadHosts: () => void;
  onClearHiddenDownloadHosts: () => void;
  onOpenImportTagsMap: () => void;
  onImportTagsMapChange: () => void;
  onExportSessionState: () => void;
  onOpenImportSessionState: () => void;
  onImportSessionStateChange: () => void;
  onClearAllData: () => void;
  importSessionStateInputRef: RefObject<HTMLInputElement | null>;
  importTagsMapInputRef: RefObject<HTMLInputElement | null>;
};

const formatDisabledUntilTime = (expiresAtUnixMs: number) => {
  return new Date(expiresAtUnixMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const SettingsPage = ({
  preferredDownloadHosts,
  disabledDownloadHosts,
  hiddenDownloadHosts,
  knownDownloadHosts,
  tagsCount,
  metadataSyncState,
  onMoveDownloadHost,
  onDisableDownloadHostTemporarily,
  onEnableDownloadHost,
  onHideDownloadHost,
  onShowDownloadHost,
  onResetPreferredDownloadHosts,
  onClearDisabledDownloadHosts,
  onClearHiddenDownloadHosts,
  onOpenImportTagsMap,
  onImportTagsMapChange,
  onExportSessionState,
  onOpenImportSessionState,
  onImportSessionStateChange,
  onClearAllData,
  importSessionStateInputRef,
  importTagsMapInputRef,
}: SettingsPageProps) => {
  const pausedHostCount = Object.keys(disabledDownloadHosts).length;
  const hiddenHostCount = hiddenDownloadHosts.length;
  const visibleHostList = knownDownloadHosts.filter(
    (hostLabel) => !hiddenDownloadHosts.includes(hostLabel),
  );
  const collapsedHiddenHostList = knownDownloadHosts.filter((hostLabel) =>
    hiddenDownloadHosts.includes(hostLabel),
  );
  const [activeTab, setActiveTab] = useState<
    "hosts" | "cookies" | "tags" | "data"
  >("hosts");
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
  const cookieFileInputRef = useRef<HTMLInputElement | null>(null);

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
            Разделы вынесены во вкладки: host'ы, куки для proxy, теги и
            локальные данные.
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
              activeTab === "tags" ? "settingsTabButtonActive" : ""
            }`}
            type="button"
            role="tab"
            aria-selected={activeTab === "tags"}
            onClick={() => setActiveTab("tags")}
          >
            Теги
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
            Данные
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
                `Выше` и `Ниже` меняют место в общем списке. `Скрыть` убирает
                host из one-click и из модалки зеркал. Скрытые host'ы собраны в
                отдельном раскрывающемся блоке ниже.
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
                            className="button settingsHostActionButton settingsHostActionButtonHidden"
                            type="button"
                            onClick={() => onHideDownloadHost(hostLabel)}
                          >
                            Скрыть
                          </button>
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
        ) : activeTab === "tags" ? (
          <div className="panel">
            <div className="sectionTitleRow">
              <div className="sectionTitle">Импорт тегов</div>
              <div className="sectionMeta">
                Локальная карта id to label для интерфейса
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
                onClick={onOpenImportTagsMap}
              >
                Импорт tagsMap.json
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
                Формат: {`{ "45": "3D", "130": "RenPy" }`}
              </div>
              <div className="smallText">
                Эти данные используются для подписей тегов в карточках и
                дашборде.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="panel">
              <div className="sectionTitleRow">
                <div className="sectionTitle">Локальные данные</div>
                <div className="sectionMeta">
                  Экспорт, импорт и полная очистка
                </div>
              </div>

              <div className="settingsActions">
                <button
                  className="button"
                  type="button"
                  onClick={onExportSessionState}
                >
                  Экспортировать
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={onOpenImportSessionState}
                >
                  Импорт
                </button>
                <button
                  className="button buttonDanger"
                  type="button"
                  onClick={onClearAllData}
                >
                  Очистить
                </button>
              </div>

              <input
                ref={importSessionStateInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={onImportSessionStateChange}
              />

              <div className="settingsDataNote">
                <div className="smallText">
                  `Экспортировать` сохраняет локальную сессию и карты тегов в
                  JSON.
                </div>
                <div className="smallText">
                  `Импорт` поднимает сохраненное состояние обратно в
                  приложение.
                </div>
                <div className="smallText">
                  `Очистить` удаляет сессию, кэш страниц, download cache и
                  локальные настройки host'ов.
                </div>
              </div>
            </div>

            <SyncMetadataPanel metadataSyncState={metadataSyncState} />
          </>
        )}
      </div>
    </div>
  );
};
