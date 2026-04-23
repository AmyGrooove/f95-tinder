import type { CookieProxyBackup } from "../f95/cookieProxy";
import {
  normalizeDefaultSwipeSettings,
  normalizeDashboardViewState,
  normalizePrefixesMap,
  normalizeSessionState,
  normalizeTagsMap,
} from "../f95/storage";
import type {
  DashboardViewState,
  DefaultSwipeSettings,
  SessionState,
} from "../f95/types";

type LocalListsBackup = {
  sessionState: SessionState;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
};

type LocalSettingsBackup = {
  defaultSwipeSettings: DefaultSwipeSettings;
  dashboardViewState: DashboardViewState;
  tagsMap: Record<string, string>;
  prefixesMap: Record<string, string>;
  preferredDownloadHosts: string[];
  disabledDownloadHosts: Record<string, number>;
  hiddenDownloadHosts: string[];
  cookieProxy: CookieProxyBackup | null;
};

type LocalBackupFile = {
  format: "f95-tinder-local-backup-v1";
  exportType: "all" | "settings" | "lists";
  exportedAtUnixMs: number;
  lists?: LocalListsBackup;
  settings?: LocalSettingsBackup;
};

const LOCAL_BACKUP_FORMAT = "f95-tinder-local-backup-v1";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isLocalBackupFile = (value: unknown): value is LocalBackupFile => {
  return (
    isRecord(value) &&
    value.format === LOCAL_BACKUP_FORMAT &&
    (value.exportType === "all" ||
      value.exportType === "settings" ||
      value.exportType === "lists")
  );
};

const normalizeImportedStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const normalizeImportedDisabledDownloadHosts = (value: unknown) => {
  if (!isRecord(value)) {
    return {};
  }

  const normalizedMap: Record<string, number> = {};
  for (const [hostLabel, expiresAtUnixMs] of Object.entries(value)) {
    if (
      typeof hostLabel === "string" &&
      typeof expiresAtUnixMs === "number" &&
      Number.isFinite(expiresAtUnixMs)
    ) {
      normalizedMap[hostLabel] = expiresAtUnixMs;
    }
  }

  return normalizedMap;
};

const normalizeCookieProxyBackup = (value: unknown): CookieProxyBackup => {
  if (!isRecord(value)) {
    return {
      source: "none",
      text: null,
      updatedAtUnixMs: null,
    };
  }

  const source =
    value.source === "settings" || value.source === "env" || value.source === "none"
      ? value.source
      : "none";

  return {
    source,
    text: typeof value.text === "string" ? value.text : null,
    updatedAtUnixMs:
      typeof value.updatedAtUnixMs === "number" ? value.updatedAtUnixMs : null,
  };
};

const extractLocalListsBackup = (value: unknown): LocalListsBackup => {
  const rawValue = isLocalBackupFile(value) ? value.lists : value;
  if (!isRecord(rawValue)) {
    throw new Error("Импорт списков: ожидается объект с данными списков");
  }

  const nextSessionState = normalizeSessionState(rawValue.sessionState);
  if (!nextSessionState) {
    throw new Error("Импорт списков: sessionState имеет неверный формат");
  }

  return {
    sessionState: nextSessionState,
    tagsMap: normalizeTagsMap(rawValue.tagsMap),
    prefixesMap: normalizePrefixesMap(rawValue.prefixesMap),
  };
};

const extractLocalSettingsBackup = (value: unknown): LocalSettingsBackup => {
  const rawValue = isLocalBackupFile(value) ? value.settings : value;
  if (!isRecord(rawValue)) {
    throw new Error("Импорт настроек: ожидается объект с данными настроек");
  }
  if (!("defaultSwipeSettings" in rawValue)) {
    throw new Error(
      "Импорт настроек: в файле нет defaultSwipeSettings для восстановления настроек",
    );
  }

  return {
    defaultSwipeSettings: normalizeDefaultSwipeSettings(rawValue.defaultSwipeSettings),
    dashboardViewState: normalizeDashboardViewState(rawValue.dashboardViewState),
    tagsMap: normalizeTagsMap(rawValue.tagsMap),
    prefixesMap: normalizePrefixesMap(rawValue.prefixesMap),
    preferredDownloadHosts: normalizeImportedStringList(
      rawValue.preferredDownloadHosts,
    ),
    disabledDownloadHosts: normalizeImportedDisabledDownloadHosts(
      rawValue.disabledDownloadHosts,
    ),
    hiddenDownloadHosts: normalizeImportedStringList(rawValue.hiddenDownloadHosts),
    cookieProxy:
      "cookieProxy" in rawValue ? normalizeCookieProxyBackup(rawValue.cookieProxy) : null,
  };
};

const extractLocalAllBackup = (
  value: unknown,
): { lists: LocalListsBackup; settings: LocalSettingsBackup } => {
  if (!isLocalBackupFile(value) || !value.lists || !value.settings) {
    throw new Error(
      "Импорт всего: ожидается backup-файл, в котором есть и lists, и settings",
    );
  }

  return {
    lists: extractLocalListsBackup(value),
    settings: extractLocalSettingsBackup(value),
  };
};

export {
  extractLocalAllBackup,
  extractLocalListsBackup,
  extractLocalSettingsBackup,
  LOCAL_BACKUP_FORMAT,
};

export type { LocalBackupFile, LocalListsBackup, LocalSettingsBackup };
