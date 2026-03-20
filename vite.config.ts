import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const F95_ORIGIN = "https://f95zone.to";
const COOKIE_STORE_PATH = path.resolve(process.cwd(), ".f95-cookie.local");
const RECOMMENDED_COOKIE_NAMES = ["xf_user", "xf_session", "xf_csrf"] as const;

type CookieSource = "settings" | "env" | "none";

type RuntimeCookieState = {
  header: string;
  source: CookieSource;
  updatedAtUnixMs: number | null;
};

const isF95Domain = (value: string) => {
  const normalizedValue = value.trim().replace(/^\./, "").toLowerCase();
  return normalizedValue === "f95zone.to" || normalizedValue.endsWith(".f95zone.to");
};

const unwrapCookieInput = (value: string) => {
  let normalizedValue = value.trim();

  if (normalizedValue.startsWith("F95_COOKIE=")) {
    normalizedValue = normalizedValue.slice("F95_COOKIE=".length).trim();
  }

  if (
    (normalizedValue.startsWith('"') && normalizedValue.endsWith('"')) ||
    (normalizedValue.startsWith("'") && normalizedValue.endsWith("'"))
  ) {
    normalizedValue = normalizedValue.slice(1, -1).trim();
  }

  return normalizedValue;
};

const appendCookiePair = (
  cookieMap: Map<string, string>,
  name: string,
  value: string,
) => {
  const normalizedName = name.trim();
  const normalizedValue = value.trim();
  if (!normalizedName || !normalizedValue) {
    return;
  }

  cookieMap.set(normalizedName, normalizedValue);
};

const extractCookiePairsFromHeader = (value: string) => {
  const cookieMap = new Map<string, string>();
  const normalizedValue = unwrapCookieInput(value).replace(/\r?\n/g, "; ");

  for (const part of normalizedValue.split(";")) {
    const trimmedPart = part.trim();
    const separatorIndex = trimmedPart.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    appendCookiePair(
      cookieMap,
      trimmedPart.slice(0, separatorIndex),
      trimmedPart.slice(separatorIndex + 1),
    );
  }

  return Array.from(cookieMap.entries());
};

const extractCookiePairsFromJson = (value: string) => {
  try {
    const parsedValue = JSON.parse(value) as unknown;
    const cookieMap = new Map<string, string>();

    if (Array.isArray(parsedValue)) {
      for (const item of parsedValue) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          continue;
        }

        const record = item as Record<string, unknown>;
        const nameValue = record.name;
        const cookieValue = record.value;
        const domainValue = record.domain;
        if (typeof nameValue !== "string" || typeof cookieValue !== "string") {
          continue;
        }
        if (typeof domainValue === "string" && !isF95Domain(domainValue)) {
          continue;
        }

        appendCookiePair(cookieMap, nameValue, cookieValue);
      }
    } else if (
      parsedValue &&
      typeof parsedValue === "object" &&
      !Array.isArray(parsedValue)
    ) {
      for (const [key, cookieValue] of Object.entries(parsedValue)) {
        if (typeof cookieValue !== "string") {
          continue;
        }
        appendCookiePair(cookieMap, key, cookieValue);
      }
    }

    return Array.from(cookieMap.entries());
  } catch {
    return [];
  }
};

const extractCookiePairsFromTable = (value: string) => {
  const cookieMap = new Map<string, string>();
  const lineList = value.replace(/\r/g, "").split("\n");

  for (const rawLine of lineList) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    if (/^name\s+value/i.test(trimmedLine)) {
      continue;
    }

    if (trimmedLine.includes("\t")) {
      const tokenList = trimmedLine
        .split("\t")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      if (tokenList.length >= 7 && isF95Domain(tokenList[0])) {
        appendCookiePair(cookieMap, tokenList[5], tokenList[6]);
        continue;
      }

      if (
        tokenList.length >= 3 &&
        isF95Domain(tokenList[2]) &&
        tokenList[0].toLowerCase() !== "name"
      ) {
        appendCookiePair(cookieMap, tokenList[0], tokenList[1]);
        continue;
      }

      if (tokenList.length >= 2 && /^xf_/i.test(tokenList[0])) {
        appendCookiePair(cookieMap, tokenList[0], tokenList[1]);
        continue;
      }
    }

    const tokenList = trimmedLine.split(/\s+/);
    if (tokenList.length >= 2 && /^xf_/i.test(tokenList[0])) {
      appendCookiePair(cookieMap, tokenList[0], tokenList[1]);
    }
  }

  return Array.from(cookieMap.entries());
};

const extractCookiePairsFromInput = (value: string) => {
  const normalizedValue = unwrapCookieInput(value);
  if (!normalizedValue) {
    return [];
  }

  const jsonPairs = extractCookiePairsFromJson(normalizedValue);
  if (jsonPairs.length > 0) {
    return jsonPairs;
  }

  const tablePairs = extractCookiePairsFromTable(normalizedValue);
  if (tablePairs.length > 0) {
    return tablePairs;
  }

  return extractCookiePairsFromHeader(normalizedValue);
};

const serializeCookiePairs = (cookiePairList: Array<[string, string]>) => {
  return cookiePairList
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
};

const extractCookieNames = (headerValue: string) => {
  return extractCookiePairsFromHeader(headerValue).map(([name]) => name);
};

const buildCookieStatus = (runtimeCookieState: RuntimeCookieState) => {
  const cookieNameList = extractCookieNames(runtimeCookieState.header);
  const normalizedCookieNameList = cookieNameList.map((item) => item.toLowerCase());

  return {
    configured: runtimeCookieState.header.length > 0,
    source: runtimeCookieState.source,
    cookieNames: cookieNameList,
    missingRecommendedCookieNames: RECOMMENDED_COOKIE_NAMES.filter(
      (cookieName) => !normalizedCookieNameList.includes(cookieName),
    ),
    updatedAtUnixMs: runtimeCookieState.updatedAtUnixMs,
  };
};

const sendJson = (response: NodeJS.WritableStream & { setHeader: Function; end: Function; statusCode: number }, payload: unknown) => {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
};

const readRequestBody = async (
  request: AsyncIterable<Buffer | string>,
) => {
  const chunkList: Buffer[] = [];

  for await (const chunk of request) {
    chunkList.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunkList);
};

const loadRuntimeCookieState = (envCookieHeader?: string): RuntimeCookieState => {
  try {
    if (fs.existsSync(COOKIE_STORE_PATH)) {
      const fileText = fs.readFileSync(COOKIE_STORE_PATH, "utf8").trim();
      if (fileText) {
        const stat = fs.statSync(COOKIE_STORE_PATH);
        return {
          header: fileText,
          source: "settings",
          updatedAtUnixMs: Math.round(stat.mtimeMs),
        };
      }
    }
  } catch {
    // ignore
  }

  if (envCookieHeader?.trim()) {
    return {
      header: envCookieHeader.trim(),
      source: "env",
      updatedAtUnixMs: null,
    };
  }

  return {
    header: "",
    source: "none",
    updatedAtUnixMs: null,
  };
};

const createF95ProxyPlugin = (envCookieHeader?: string): Plugin => {
  let runtimeCookieState = loadRuntimeCookieState(envCookieHeader);

  const applyMiddlewareStack = (
    middlewares: { use: (handler: (req: any, res: any, next: () => void) => void | Promise<void>) => void },
  ) => {
    middlewares.use(async (request, response, next) => {
      const requestUrl = request.url ?? "";

      if (requestUrl === "/__f95_config/status" && request.method === "GET") {
        sendJson(response, buildCookieStatus(runtimeCookieState));
        return;
      }

      if (requestUrl === "/__f95_config/cookie") {
        if (request.method === "POST") {
          try {
            const requestBody = await readRequestBody(request);
            const parsedBody = JSON.parse(requestBody.toString("utf8")) as {
              text?: unknown;
            };
            const inputText =
              typeof parsedBody?.text === "string" ? parsedBody.text : "";
            const cookiePairList = extractCookiePairsFromInput(inputText);

            if (cookiePairList.length === 0) {
              response.statusCode = 400;
              sendJson(response, {
                error:
                  "Не удалось распознать куки. Вставь F95_COOKIE, cookies.txt, JSON или таблицу из DevTools.",
              });
              return;
            }

            const nextHeaderValue = serializeCookiePairs(cookiePairList);
            fs.writeFileSync(COOKIE_STORE_PATH, `${nextHeaderValue}\n`, "utf8");
            runtimeCookieState = {
              header: nextHeaderValue,
              source: "settings",
              updatedAtUnixMs: Date.now(),
            };

            sendJson(response, buildCookieStatus(runtimeCookieState));
            return;
          } catch (error) {
            response.statusCode = 400;
            sendJson(response, {
              error:
                error instanceof Error
                  ? error.message
                  : "Не удалось сохранить куки",
            });
            return;
          }
        }

        if (request.method === "DELETE") {
          try {
            if (fs.existsSync(COOKIE_STORE_PATH)) {
              fs.unlinkSync(COOKIE_STORE_PATH);
            }
          } catch {
            // ignore
          }

          runtimeCookieState = loadRuntimeCookieState(envCookieHeader);
          sendJson(response, buildCookieStatus(runtimeCookieState));
          return;
        }
      }

      if (!requestUrl.startsWith("/f95")) {
        next();
        return;
      }

      try {
        const upstreamPath = requestUrl.slice("/f95".length) || "/";
        const targetUrl = new URL(upstreamPath, F95_ORIGIN);
        const upstreamHeaders = new Headers();

        for (const [headerName, headerValue] of Object.entries(request.headers)) {
          if (
            !headerValue ||
            headerName === "host" ||
            headerName === "connection" ||
            headerName === "content-length"
          ) {
            continue;
          }

          upstreamHeaders.set(
            headerName,
            Array.isArray(headerValue) ? headerValue.join(", ") : headerValue,
          );
        }

        if (runtimeCookieState.header) {
          upstreamHeaders.set("cookie", runtimeCookieState.header);
        }

        const requestBody =
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : await readRequestBody(request);

        const upstreamResponse = await fetch(targetUrl, {
          method: request.method,
          headers: upstreamHeaders,
          body: requestBody,
          redirect: "follow",
        });

        response.statusCode = upstreamResponse.status;

        upstreamResponse.headers.forEach((headerValue, headerName) => {
          if (
            headerName === "content-length" ||
            headerName === "content-encoding" ||
            headerName === "transfer-encoding" ||
            headerName === "connection"
          ) {
            return;
          }

          response.setHeader(headerName, headerValue);
        });

        response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
      } catch (error) {
        response.statusCode = 502;
        sendJson(response, {
          error:
            error instanceof Error
              ? error.message
              : "Не удалось обратиться к F95",
        });
      }
    });
  };

  return {
    name: "f95-runtime-cookie-proxy",
    configureServer(server) {
      applyMiddlewareStack(server.middlewares);
    },
    configurePreviewServer(server) {
      applyMiddlewareStack(server.middlewares);
    },
  };
};

export default defineConfig(({ mode }) => {
  const viteEnv = loadEnv(mode, process.cwd(), "");
  const f95CookieHeader = viteEnv.F95_COOKIE?.trim();

  return {
    base: mode === "production" ? "./" : "/",
    plugins: [react(), createF95ProxyPlugin(f95CookieHeader)],
  };
});
