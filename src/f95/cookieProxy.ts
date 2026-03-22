import {
  clearCookieInputViaLauncher,
  getCookieBackupViaLauncher,
  getCookieStatusViaLauncher,
  saveCookieInputViaLauncher,
} from "../launcher/runtime";

export type CookieProxyStatus = {
  configured: boolean;
  source: "settings" | "env" | "none";
  cookieNames: string[];
  missingRecommendedCookieNames: string[];
  updatedAtUnixMs: number | null;
};

export type CookieProxyBackup = {
  source: "settings" | "env" | "none";
  text: string | null;
  updatedAtUnixMs: number | null;
};

const COOKIE_PROXY_STATUS_ENDPOINT = "/__f95_config/status";
const COOKIE_PROXY_UPDATE_ENDPOINT = "/__f95_config/cookie";

const assertCookieProxyStatus = (value: unknown): CookieProxyStatus => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Некорректный ответ proxy");
  }

  const record = value as Record<string, unknown>;
  const sourceValue = record.source;
  if (
    sourceValue !== "settings" &&
    sourceValue !== "env" &&
    sourceValue !== "none"
  ) {
    throw new Error("Некорректный source у proxy");
  }

  return {
    configured: Boolean(record.configured),
    source: sourceValue,
    cookieNames: Array.isArray(record.cookieNames)
      ? record.cookieNames.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    missingRecommendedCookieNames: Array.isArray(
      record.missingRecommendedCookieNames,
    )
      ? record.missingRecommendedCookieNames.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    updatedAtUnixMs:
      typeof record.updatedAtUnixMs === "number" ? record.updatedAtUnixMs : null,
  };
};

const readErrorMessage = async (response: Response) => {
  try {
    const parsedJson = (await response.json()) as { error?: unknown };
    if (typeof parsedJson?.error === "string" && parsedJson.error.trim()) {
      return parsedJson.error;
    }
  } catch {
    // ignore
  }

  return `Proxy error: ${response.status}`;
};

const assertCookieProxyBackup = (value: unknown): CookieProxyBackup => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Некорректный ответ proxy");
  }

  const record = value as Record<string, unknown>;
  const sourceValue = record.source;
  if (
    sourceValue !== "settings" &&
    sourceValue !== "env" &&
    sourceValue !== "none"
  ) {
    throw new Error("Некорректный source у proxy");
  }

  return {
    source: sourceValue,
    text: typeof record.text === "string" ? record.text : null,
    updatedAtUnixMs:
      typeof record.updatedAtUnixMs === "number" ? record.updatedAtUnixMs : null,
  };
};

const fetchCookieProxyStatus = async () => {
  const launcherStatus = await getCookieStatusViaLauncher();
  if (launcherStatus) {
    return assertCookieProxyStatus(launcherStatus);
  }

  const response = await fetch(COOKIE_PROXY_STATUS_ENDPOINT, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return assertCookieProxyStatus(await response.json());
};

const fetchCookieProxyBackup = async () => {
  const launcherBackup = await getCookieBackupViaLauncher();
  if (launcherBackup) {
    return assertCookieProxyBackup(launcherBackup);
  }

  const response = await fetch(COOKIE_PROXY_UPDATE_ENDPOINT, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return assertCookieProxyBackup(await response.json());
};

const saveCookieProxyInput = async (text: string) => {
  const launcherStatus = await saveCookieInputViaLauncher(text);
  if (launcherStatus) {
    return assertCookieProxyStatus(launcherStatus);
  }

  const response = await fetch(COOKIE_PROXY_UPDATE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return assertCookieProxyStatus(await response.json());
};

const clearCookieProxyInput = async () => {
  const launcherStatus = await clearCookieInputViaLauncher();
  if (launcherStatus) {
    return assertCookieProxyStatus(launcherStatus);
  }

  const response = await fetch(COOKIE_PROXY_UPDATE_ENDPOINT, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return assertCookieProxyStatus(await response.json());
};

export {
  clearCookieProxyInput,
  fetchCookieProxyBackup,
  fetchCookieProxyStatus,
  saveCookieProxyInput,
};
