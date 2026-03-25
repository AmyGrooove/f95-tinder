const GENERIC_DOWNLOAD_SCENARIO_ID = 'GENERIC'
const DEFAULT_AUTOMATION_RETRY_AFTER_MS = 1_250
const AUTOMATION_REASON_CODES = Object.freeze({
  CAPTCHA_REQUIRED: 'captcha_required',
  NO_ACTIONABLE_ELEMENT: 'no_actionable_element',
  WAITING_FOR_CONTINUE: 'waiting_for_continue',
  WAITING_FOR_DOWNLOAD: 'waiting_for_download',
  WAITING_FOR_ARCHIVE_ROW: 'waiting_for_archive_row',
  COUNTDOWN_PENDING: 'countdown_pending',
  DOWNLOAD_LIMIT_REACHED: 'download_limit_reached',
  CONCURRENT_LIMIT_REACHED: 'concurrent_limit_reached',
  AUTOMATION_ERROR: 'automation_error',
  DOWNLOAD_TIMEOUT: 'download_timeout',
  MANUAL_ACTION_REQUIRED: 'manual_action_required',
})
const WAITING_AUTOMATION_REASON_CODE_SET = new Set([
  AUTOMATION_REASON_CODES.NO_ACTIONABLE_ELEMENT,
  AUTOMATION_REASON_CODES.WAITING_FOR_CONTINUE,
  AUTOMATION_REASON_CODES.WAITING_FOR_DOWNLOAD,
  AUTOMATION_REASON_CODES.WAITING_FOR_ARCHIVE_ROW,
  AUTOMATION_REASON_CODES.COUNTDOWN_PENDING,
])

const normalizeAutomationReasonCode = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalizedValue = value.trim().toLowerCase()
  return normalizedValue.length > 0 ? normalizedValue : null
}

const normalizeAutomationRetryAfterMs = (value, reasonCode) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value)
  }

  if (reasonCode && WAITING_AUTOMATION_REASON_CODE_SET.has(reasonCode)) {
    return DEFAULT_AUTOMATION_RETRY_AFTER_MS
  }

  return null
}

const normalizeDownloadHostLabel = (value) =>
  String(value ?? '')
    .trim()
    .replace(/^[^A-Za-z0-9]+/, '')
    .toUpperCase()

const buildGenericAutoClickScript = (scenario) => `
(() => {
  const scenarioId = ${JSON.stringify(scenario.id)};
  const scenarioLabel = ${JSON.stringify(scenario.label)};
  const normalize = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\\s+/g, ' ');

  const pageText = normalize(document.body?.innerText ?? '');
  const hasCaptcha =
    pageText.includes('captcha') ||
    pageText.includes('i am human') ||
    pageText.includes('verify you are human') ||
    document.querySelector('.g-recaptcha, .h-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"]') !== null;

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const candidateList = Array.from(
    document.querySelectorAll('a[href], button, input[type="button"], input[type="submit"], [role="button"]'),
  );

  let bestCandidate = null;

  for (const element of candidateList) {
    if (!(element instanceof HTMLElement) || !isVisible(element)) {
      continue;
    }

    if (
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-disabled') === 'true'
    ) {
      continue;
    }

    const text = normalize(
      [
        element.innerText,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('value'),
        element.getAttribute('href'),
        element.getAttribute('id'),
        element.className,
      ]
        .filter(Boolean)
        .join(' '),
    );

    let score = 0;

    if (text.includes('download')) score += 120;
    if (text.includes('continue')) score += 60;
    if (text.includes('click here')) score += 55;
    if (text.includes('get link')) score += 50;
    if (text.includes('slow')) score += 25;
    if (text.includes('free')) score += 20;
    if (text.includes('direct')) score += 35;
    if (text.includes('mirror')) score += 20;
    if (text.includes('.zip') || text.includes('.rar') || text.includes('.7z')) score += 100;
    if (text.includes('premium') || text.includes('login') || text.includes('sign in') || text.includes('register') || text.includes('advert')) score -= 120;

    if (element.tagName === 'A') {
      const href = normalize(element.getAttribute('href'));
      if (/\\.(zip|rar|7z)(\\?|$)/i.test(href)) {
        score += 160;
      }
    }

    if (score <= 0) {
      continue;
    }

    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = {
        element,
        score,
        text,
      };
    }
  }

  if (!bestCandidate) {
    return {
      scenarioId,
      scenarioLabel,
      clicked: false,
      label: null,
      hasCaptcha,
      location: window.location.href,
      phase: 'generic_wait',
      note: 'No matching element found',
      reasonCode: hasCaptcha
        ? ${JSON.stringify(AUTOMATION_REASON_CODES.CAPTCHA_REQUIRED)}
        : ${JSON.stringify(AUTOMATION_REASON_CODES.NO_ACTIONABLE_ELEMENT)},
      retryAfterMs: hasCaptcha ? null : ${DEFAULT_AUTOMATION_RETRY_AFTER_MS},
      errorMessage: null,
    };
  }

  bestCandidate.element.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    }),
  );

  return {
    scenarioId,
    scenarioLabel,
    clicked: true,
    label: bestCandidate.text,
    hasCaptcha,
    location: window.location.href,
    phase: 'generic_click',
    note: null,
    reasonCode: null,
    retryAfterMs: null,
    errorMessage: null,
  };
})();
`

const buildPixeldrainAutomationScript = () => {
  return `
(() => {
  const scenarioId = 'PIXELDRAIN';
  const scenarioLabel = 'Pixeldrain';
  const normalize = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\\s+/g, ' ');
  const currentUrl = String(window.location.href ?? '');
  const pageTextRaw = String(document.body?.innerText ?? '');
  const pageText = normalize(pageTextRaw);
  const hasCaptcha =
    pageText.includes('captcha') ||
    pageText.includes('i am human') ||
    pageText.includes('verify you are human') ||
    document.querySelector('.g-recaptcha, .h-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"]') !== null;

  const createResult = (patch = {}) => ({
    scenarioId,
    scenarioLabel,
    clicked: false,
    label: null,
    hasCaptcha,
    location: currentUrl,
    phase: null,
    note: null,
    reasonCode: hasCaptcha
      ? ${JSON.stringify(AUTOMATION_REASON_CODES.CAPTCHA_REQUIRED)}
      : null,
    retryAfterMs: null,
    errorMessage: null,
    ...patch,
  });

  const parseByteAmount = (rawValue, rawUnit) => {
    const normalizedUnit = normalize(rawUnit);
    const numericValue = Number.parseFloat(String(rawValue).replace(',', '.'));
    if (!Number.isFinite(numericValue)) {
      return null;
    }

    const multiplierByUnit = {
      b: 1,
      kb: 1024,
      mb: 1024 ** 2,
      gb: 1024 ** 3,
      tb: 1024 ** 4,
    };

    const multiplier = multiplierByUnit[normalizedUnit];
    if (!multiplier) {
      return null;
    }

    return numericValue * multiplier;
  };

  const limitMatch = /download limit used:\\s*([\\d.,]+)\\s*([kmgt]?b)\\s*of\\s*([\\d.,]+)\\s*([kmgt]?b)/i.exec(
    pageTextRaw,
  );
  if (limitMatch) {
    const usedBytes = parseByteAmount(limitMatch[1], limitMatch[2]);
    const totalBytes = parseByteAmount(limitMatch[3], limitMatch[4]);

    if (
      usedBytes !== null &&
      totalBytes !== null &&
      usedBytes >= totalBytes
    ) {
      return createResult({
        phase: 'limit_reached',
        reasonCode: ${JSON.stringify(
          AUTOMATION_REASON_CODES.DOWNLOAD_LIMIT_REACHED,
        )},
        errorMessage: \`Pixeldrain: исчерпан лимит скачивания (\${limitMatch[0].trim()}).\`,
      });
    }
  }

  const concurrentLimitPatterns = [
    /(can only|only)\\s+download\\s+5\\s+(files|downloads).{0,40}(same time|at once)/i,
    /too many\\s+(active|concurrent)\\s+downloads/i,
    /(maximum|max)\\s+(active|concurrent)\\s+downloads/i,
    /concurrent\\s+download\\s+limit/i,
    /5\\s+(active|concurrent)\\s+downloads/i,
  ];
  if (concurrentLimitPatterns.some((pattern) => pattern.test(pageTextRaw))) {
    return createResult({
      phase: 'concurrent_limit',
      reasonCode: ${JSON.stringify(
        AUTOMATION_REASON_CODES.CONCURRENT_LIMIT_REACHED,
      )},
      errorMessage:
        'Pixeldrain: достигнут лимит одновременных скачиваний (до 5 одновременно).',
    });
  }

  if (
    /download\\s+limit\\s+(reached|exceeded)/i.test(pageTextRaw) ||
    /daily\\s+(download|transfer)\\s+limit/i.test(pageTextRaw) ||
    /quota\\s+(reached|exceeded)/i.test(pageTextRaw)
  ) {
    return createResult({
      phase: 'limit_reached',
      reasonCode: ${JSON.stringify(
        AUTOMATION_REASON_CODES.DOWNLOAD_LIMIT_REACHED,
      )},
      errorMessage: 'Pixeldrain: достигнут лимит скачивания.',
    });
  }

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const candidateList = Array.from(
    document.querySelectorAll(
      'a[href], button, input[type="button"], input[type="submit"], [role="button"]',
    ),
  );

  const findBestCandidate = (getScore) => {
    let bestCandidate = null;

    for (const element of candidateList) {
      if (!(element instanceof HTMLElement) || !isVisible(element)) {
        continue;
      }

      if (
        element.hasAttribute('disabled') ||
        element.getAttribute('aria-disabled') === 'true'
      ) {
        continue;
      }

      const text = normalize(
        [
          element.innerText,
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.getAttribute('value'),
          element.getAttribute('href'),
          element.getAttribute('id'),
          element.className,
        ]
          .filter(Boolean)
          .join(' '),
      );

      const score = getScore(text, element);
      if (score <= 0) {
        continue;
      }

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          element,
          score,
          text,
        };
      }
    }

    return bestCandidate;
  };

  const dispatchClick = (target) => {
    target.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  };

  const continueCandidate = findBestCandidate((text) => {
    if (text.includes('continue to pixeldrain')) {
      return 240;
    }
    if (text.includes('continue') && text.includes('pixeldrain')) {
      return 200;
    }
    return 0;
  });

  if (continueCandidate) {
    dispatchClick(continueCandidate.element);
    return createResult({
      clicked: true,
      label: continueCandidate.text,
      phase: 'masked_continue',
      note: 'Continue to Pixeldrain',
      reasonCode: null,
      retryAfterMs: null,
    });
  }

  const downloadCandidate = findBestCandidate((text, element) => {
    let score = 0;

    if (text === 'download') {
      score += 240;
    } else if (text.startsWith('download')) {
      score += 180;
    } else if (text.includes(' download ')) {
      score += 150;
    } else if (text.includes('download')) {
      score += 120;
    }

    if (text.includes('desktop app') || text.includes('open app')) {
      score -= 120;
    }

    if (element.tagName === 'A') {
      const href = normalize(element.getAttribute('href'));
      if (href.includes('/api/') || href.includes('/download')) {
        score += 25;
      }
    }

    return score;
  });

  if (downloadCandidate) {
    dispatchClick(downloadCandidate.element);
    return createResult({
      clicked: true,
      label: downloadCandidate.text,
      phase: 'host_download',
      note: 'Download',
      reasonCode: null,
      retryAfterMs: null,
    });
  }

  if (currentUrl.includes('/masked/') || pageText.includes('continue to pixeldrain')) {
    return createResult({
      phase: 'masked_wait',
      note: 'Waiting for Continue to Pixeldrain button',
      reasonCode: ${JSON.stringify(
        AUTOMATION_REASON_CODES.WAITING_FOR_CONTINUE,
      )},
      retryAfterMs: ${DEFAULT_AUTOMATION_RETRY_AFTER_MS},
    });
  }

  return createResult({
    phase: 'host_wait',
    note: 'Waiting for Pixeldrain download button',
    reasonCode: ${JSON.stringify(AUTOMATION_REASON_CODES.WAITING_FOR_DOWNLOAD)},
    retryAfterMs: ${DEFAULT_AUTOMATION_RETRY_AFTER_MS},
  });
})();
`
}

const buildGofileAutomationScript = () => {
  return `
(() => {
  const scenarioId = 'GOFILE';
  const scenarioLabel = 'Gofile';
  const normalize = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\\s+/g, ' ');
  const currentUrl = String(window.location.href ?? '');
  const pageTextRaw = String(document.body?.innerText ?? '');
  const pageText = normalize(pageTextRaw);
  const hasCaptcha =
    pageText.includes('captcha') ||
    pageText.includes('i am human') ||
    pageText.includes('verify you are human') ||
    document.querySelector('.g-recaptcha, .h-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"]') !== null;

  const createResult = (patch = {}) => ({
    scenarioId,
    scenarioLabel,
    clicked: false,
    label: null,
    hasCaptcha,
    location: currentUrl,
    phase: null,
    note: null,
    reasonCode: hasCaptcha
      ? ${JSON.stringify(AUTOMATION_REASON_CODES.CAPTCHA_REQUIRED)}
      : null,
    retryAfterMs: null,
    errorMessage: null,
    ...patch,
  });

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const isEnabled = (element) => {
    return !(
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-disabled') === 'true'
    );
  };

  const collectElementText = (element) =>
    normalize(
      [
        element.innerText,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('value'),
        element.getAttribute('href'),
        element.getAttribute('id'),
        element.className,
      ]
        .filter(Boolean)
        .join(' '),
    );

  const candidateList = Array.from(
    document.querySelectorAll(
      'a[href], button, input[type="button"], input[type="submit"], [role="button"]',
    ),
  ).filter((element) => element instanceof HTMLElement && isVisible(element) && isEnabled(element));

  const dispatchClick = (target) => {
    target.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  };

  const findBestClickable = (getScore) => {
    let bestCandidate = null;

    for (const element of candidateList) {
      const text = collectElementText(element);
      const score = getScore(text, element);
      if (score <= 0) {
        continue;
      }

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          element,
          score,
          text,
        };
      }
    }

    return bestCandidate;
  };

  const continueCandidate = findBestClickable((text) => {
    if (text.includes('continue to gofile')) {
      return 240;
    }
    if (text.includes('continue') && text.includes('gofile')) {
      return 200;
    }
    return 0;
  });

  if (continueCandidate) {
    dispatchClick(continueCandidate.element);
    return createResult({
      clicked: true,
      label: continueCandidate.text,
      phase: 'masked_continue',
      note: 'Continue to Gofile',
      reasonCode: null,
      retryAfterMs: null,
    });
  }

  const archivePattern = /(^|[^a-z0-9])[^\\s/]+\\.(zip|rar|7z)(\\b|$)/i;
  const archiveMarkerSelectors = [
    'a[href]',
    'button',
    'span',
    'div',
    'li',
    'td',
    'tr',
    'p',
    'strong',
  ];
  const archiveMarkerList = Array.from(
    document.querySelectorAll(archiveMarkerSelectors.join(',')),
  ).filter((element) => element instanceof HTMLElement && isVisible(element));

  const scoreArchiveMarker = (element) => {
    const text = collectElementText(element);
    if (!archivePattern.test(text)) {
      return 0;
    }

    let score = 200;
    if (text.includes('.zip')) score += 25;
    if (text.includes('.rar')) score += 20;
    if (text.includes('.7z')) score += 20;
    if (element.tagName === 'A') score += 10;
    if (text.includes('folder')) score -= 100;
    if (text.includes('import')) score -= 80;
    if (text.includes('report abuse')) score -= 80;
    return score;
  };

  const findArchiveRowDownloadPair = () => {
    let bestPair = null;

    for (const archiveMarker of archiveMarkerList) {
      const archiveScore = scoreArchiveMarker(archiveMarker);
      if (archiveScore <= 0) {
        continue;
      }

      let currentAncestor = archiveMarker;
      for (let depth = 0; depth <= 7 && currentAncestor; depth += 1) {
        const downloadCandidateList = Array.from(
          currentAncestor.querySelectorAll(
            'a[href], button, input[type="button"], input[type="submit"], [role="button"]',
          ),
        ).filter((element) => {
          return (
            element instanceof HTMLElement &&
            isVisible(element) &&
            isEnabled(element)
          );
        });

        for (const downloadCandidate of downloadCandidateList) {
          const buttonText = collectElementText(downloadCandidate);
          if (!buttonText.includes('download')) {
            continue;
          }

          let score = archiveScore + 120 - depth * 12;
          if (buttonText === 'download') {
            score += 80;
          } else if (buttonText.startsWith('download')) {
            score += 50;
          }

          if (downloadCandidate === archiveMarker) {
            score -= 25;
          }

          if (!bestPair || score > bestPair.score) {
            bestPair = {
              archiveMarker,
              downloadCandidate,
              score,
              archiveText: collectElementText(archiveMarker),
              buttonText,
            };
          }
        }

        currentAncestor = currentAncestor.parentElement;
      }
    }

    return bestPair;
  };

  const archiveRowDownloadPair = findArchiveRowDownloadPair();
  if (archiveRowDownloadPair) {
    dispatchClick(archiveRowDownloadPair.downloadCandidate);
    return createResult({
      clicked: true,
      label: archiveRowDownloadPair.buttonText,
      phase: 'host_archive_download',
      note: archiveRowDownloadPair.archiveText,
      reasonCode: null,
      retryAfterMs: null,
    });
  }

  const genericDownloadCandidate = findBestClickable((text) => {
    let score = 0;

    if (text === 'download') {
      score += 220;
    } else if (text.startsWith('download')) {
      score += 170;
    } else if (text.includes(' download ')) {
      score += 140;
    } else if (text.includes('download')) {
      score += 100;
    }

    if (text.includes('download all')) {
      score -= 30;
    }
    if (text.includes('desktop app') || text.includes('open app')) {
      score -= 120;
    }

    return score;
  });

  if (genericDownloadCandidate) {
    dispatchClick(genericDownloadCandidate.element);
    return createResult({
      clicked: true,
      label: genericDownloadCandidate.text,
      phase: 'host_download_fallback',
      note: 'Fallback Download',
      reasonCode: null,
      retryAfterMs: null,
    });
  }

  if (currentUrl.includes('/masked/') || pageText.includes('continue to gofile')) {
    return createResult({
      phase: 'masked_wait',
      note: 'Waiting for Continue to Gofile button',
      reasonCode: ${JSON.stringify(
        AUTOMATION_REASON_CODES.WAITING_FOR_CONTINUE,
      )},
      retryAfterMs: ${DEFAULT_AUTOMATION_RETRY_AFTER_MS},
    });
  }

  return createResult({
    phase: 'host_wait',
    note: 'Waiting for Gofile archive row and Download button',
    reasonCode: ${JSON.stringify(
      AUTOMATION_REASON_CODES.WAITING_FOR_ARCHIVE_ROW,
    )},
    retryAfterMs: ${DEFAULT_AUTOMATION_RETRY_AFTER_MS},
  });
})();
`
}

const buildDatanodesAutomationScript = () => {
  return `
(() => {
  const scenarioId = 'DATANODES';
  const scenarioLabel = 'Datanodes';
  const normalize = (value) =>
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\\s+/g, ' ');
  const currentUrl = String(window.location.href ?? '');
  const pageText = normalize(document.body?.innerText ?? '');
  const hasCaptcha =
    pageText.includes('captcha') ||
    pageText.includes('i am human') ||
    pageText.includes('verify you are human') ||
    document.querySelector('.g-recaptcha, .h-captcha, iframe[src*="recaptcha"], iframe[src*="hcaptcha"]') !== null;

  const createResult = (patch = {}) => ({
    scenarioId,
    scenarioLabel,
    clicked: false,
    label: null,
    hasCaptcha,
    location: currentUrl,
    phase: null,
    note: null,
    reasonCode: hasCaptcha
      ? ${JSON.stringify(AUTOMATION_REASON_CODES.CAPTCHA_REQUIRED)}
      : null,
    retryAfterMs: null,
    errorMessage: null,
    ...patch,
  });

  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const isEnabled = (element) => {
    return !(
      element.hasAttribute('disabled') ||
      element.getAttribute('aria-disabled') === 'true'
    );
  };

  const collectElementText = (element) =>
    normalize(
      [
        element.innerText,
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.getAttribute('value'),
        element.getAttribute('href'),
        element.getAttribute('id'),
        element.className,
      ]
        .filter(Boolean)
        .join(' '),
    );

  const clickables = Array.from(
    document.querySelectorAll(
      'a[href], button, input[type="button"], input[type="submit"], [role="button"]',
    ),
  ).filter((element) => element instanceof HTMLElement && isVisible(element) && isEnabled(element));

  const dispatchClick = (target) => {
    target.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }),
    );
  };

  const findBestButton = (getScore) => {
    let bestCandidate = null;

    for (const element of clickables) {
      const text = collectElementText(element);
      const score = getScore(text, element);
      if (score <= 0) {
        continue;
      }

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          element,
          score,
          text,
        };
      }
    }

    return bestCandidate;
  };

  const freeDownloadCandidate = findBestButton((text) => {
    let score = 0;

    if (text.includes('free download')) {
      score += 260;
    }
    if (text.includes('standard speed')) {
      score += 40;
    }
    if (text.includes('start download') || text.includes('preparing')) {
      score -= 180;
    }

    return score;
  });

  if (freeDownloadCandidate) {
    dispatchClick(freeDownloadCandidate.element);
    return createResult({
      clicked: true,
      label: freeDownloadCandidate.text,
      phase: 'free_download_click',
      note: 'Free Download',
      reasonCode: null,
      retryAfterMs: null,
    });
  }

  const preparingCandidate = findBestButton((text) => {
    let score = 0;

    if (text.includes('preparing')) {
      score += 260;
    }
    if (/\\b\\d+\\b/.test(text)) {
      score += 20;
    }
    if (text.includes('start download')) {
      score -= 80;
    }

    return score;
  });

  if (preparingCandidate) {
    return createResult({
      clicked: false,
      label: preparingCandidate.text,
      phase: 'preparing_wait',
      note: 'Waiting for Start Download',
      reasonCode: ${JSON.stringify(AUTOMATION_REASON_CODES.COUNTDOWN_PENDING)},
      retryAfterMs: ${DEFAULT_AUTOMATION_RETRY_AFTER_MS},
    });
  }

  const startDownloadCandidate = findBestButton((text) => {
    let score = 0;

    if (text.includes('start download')) {
      score += 280;
    }
    if (text.includes('standard speed')) {
      score += 30;
    }
    if (text.includes('free download')) {
      score -= 120;
    }

    return score;
  });

  if (startDownloadCandidate) {
    dispatchClick(startDownloadCandidate.element);
    return createResult({
      clicked: true,
      label: startDownloadCandidate.text,
      phase: 'start_download_click',
      note: 'Start Download',
      reasonCode: null,
      retryAfterMs: null,
    });
  }

  return createResult({
    phase: 'host_wait',
    note: 'Waiting for Datanodes download button state',
    reasonCode: ${JSON.stringify(AUTOMATION_REASON_CODES.WAITING_FOR_DOWNLOAD)},
    retryAfterMs: ${DEFAULT_AUTOMATION_RETRY_AFTER_MS},
  });
})();
`
}

const GENERIC_DOWNLOAD_SCENARIO = Object.freeze({
  id: GENERIC_DOWNLOAD_SCENARIO_ID,
  label: 'Generic',
  description:
    'Fallback heuristic that scans visible buttons and links for download-like actions.',
  buildScript: () =>
    buildGenericAutoClickScript({
      id: GENERIC_DOWNLOAD_SCENARIO_ID,
      label: 'Generic',
    }),
})

const DOWNLOAD_HOST_SCENARIOS = Object.freeze({
  PIXELDRAIN: Object.freeze({
    id: 'PIXELDRAIN',
    label: 'Pixeldrain',
    description:
      'Host-specific scenario placeholder. Replace the generic fallback with the real Pixeldrain flow.',
    buildScript: buildPixeldrainAutomationScript,
    suppressWindowOpenNavigation: false,
  }),
  GOFILE: Object.freeze({
    id: 'GOFILE',
    label: 'Gofile',
    description:
      'Host-specific scenario placeholder. Replace the generic fallback with the real Gofile flow.',
    buildScript: buildGofileAutomationScript,
    suppressWindowOpenNavigation: false,
  }),
  DATANODES: Object.freeze({
    id: 'DATANODES',
    label: 'Datanodes',
    description:
      'Host-specific flow for Datanodes with popup suppression and button-state automation.',
    buildScript: buildDatanodesAutomationScript,
    suppressWindowOpenNavigation: true,
  }),
})

const resolveDownloadHostScenario = (hostLabel) => {
  const normalizedHostLabel = normalizeDownloadHostLabel(hostLabel)
  if (!normalizedHostLabel) {
    return null
  }

  return DOWNLOAD_HOST_SCENARIOS[normalizedHostLabel] ?? null
}

const normalizeAutomationResult = (value, scenario) => {
  const normalizedValue =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const hasCaptcha = normalizedValue.hasCaptcha === true
  const normalizedReasonCode = normalizeAutomationReasonCode(
    normalizedValue.reasonCode,
  )
  const reasonCode =
    hasCaptcha && !normalizedReasonCode
      ? AUTOMATION_REASON_CODES.CAPTCHA_REQUIRED
      : normalizedReasonCode

  return {
    scenarioId:
      typeof normalizedValue.scenarioId === 'string'
        ? normalizeDownloadHostLabel(normalizedValue.scenarioId) || scenario.id
        : scenario.id,
    scenarioLabel:
      typeof normalizedValue.scenarioLabel === 'string' &&
      normalizedValue.scenarioLabel.trim().length > 0
        ? normalizedValue.scenarioLabel
        : scenario.label,
    clicked: normalizedValue.clicked === true,
    label:
      typeof normalizedValue.label === 'string' && normalizedValue.label.trim().length > 0
        ? normalizedValue.label
        : null,
    hasCaptcha,
    location:
      typeof normalizedValue.location === 'string' &&
      normalizedValue.location.trim().length > 0
        ? normalizedValue.location
        : null,
    phase:
      typeof normalizedValue.phase === 'string' && normalizedValue.phase.trim().length > 0
        ? normalizedValue.phase
        : null,
    note:
      typeof normalizedValue.note === 'string' && normalizedValue.note.trim().length > 0
        ? normalizedValue.note
        : null,
    reasonCode,
    retryAfterMs: normalizeAutomationRetryAfterMs(
      normalizedValue.retryAfterMs,
      reasonCode,
    ),
    errorMessage:
      typeof normalizedValue.errorMessage === 'string' &&
      normalizedValue.errorMessage.trim().length > 0
        ? normalizedValue.errorMessage
        : null,
  }
}

const runDownloadHostAutomationStep = async (
  browserWindow,
  request,
  automationState,
) => {
  const scenario =
    resolveDownloadHostScenario(request?.hostLabel) ?? GENERIC_DOWNLOAD_SCENARIO

  automationState.hostScenarioId = scenario.id
  automationState.hostScenarioLabel = scenario.label
  automationState.hostScenarioAttempts =
    (automationState.hostScenarioAttempts ?? 0) + 1

  const rawResult = await browserWindow.webContents.executeJavaScript(
    scenario.buildScript({
      request,
      automationState,
    }),
    true,
  )

  const normalizedResult = normalizeAutomationResult(rawResult, scenario)
  automationState.lastHostAutomationResult = normalizedResult
  return normalizedResult
}

module.exports = {
  AUTOMATION_REASON_CODES,
  DOWNLOAD_HOST_SCENARIOS,
  GENERIC_DOWNLOAD_SCENARIO,
  normalizeDownloadHostLabel,
  resolveDownloadHostScenario,
  runDownloadHostAutomationStep,
}
