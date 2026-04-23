import { openExternalUrl, restartLauncherApp } from "../launcher/runtime";

const openLinkInNewTab = (link: string) => {
  void openExternalUrl(link);
};

const openLinkInBackground = (link: string) => {
  void openExternalUrl(link, { background: true });
};

const restartApplicationWindow = async () => {
  await restartLauncherApp();
};

const openLinkViaAnchor = (link: string) => {
  const linkElement = document.createElement("a");
  linkElement.href = link;
  linkElement.target = "_blank";
  linkElement.rel = "noopener noreferrer";
  linkElement.click();
};

const openBackgroundTarget = () => {
  const openedWindow = window.open("", "_blank");
  if (!openedWindow) {
    return null;
  }

  try {
    openedWindow.opener = null;
    openedWindow.blur();
    window.focus();
  } catch {
    // ignore browser-specific focus restrictions
  }

  return openedWindow;
};

const navigateBackgroundTarget = (openedWindow: Window | null, link: string) => {
  if (openedWindow && !openedWindow.closed) {
    try {
      openedWindow.location.replace(link);
      openedWindow.blur();
      window.focus();
      return;
    } catch {
      // ignore and fallback to a regular new tab open
    }
  }

  openLinkViaAnchor(link);
};

const closeBackgroundTarget = (openedWindow: Window | null) => {
  if (!openedWindow || openedWindow.closed) {
    return;
  }

  try {
    openedWindow.close();
  } catch {
    // ignore
  }
};

export {
  closeBackgroundTarget,
  navigateBackgroundTarget,
  openBackgroundTarget,
  openLinkInBackground,
  openLinkInNewTab,
  restartApplicationWindow,
};
