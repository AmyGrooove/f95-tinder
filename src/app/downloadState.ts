import type { CookieProxyStatus } from "../f95/cookieProxy";
import type { DownloadLink, ThreadDownloadsData } from "../f95/types";

type BestDownloadOpenOptions = {
  openInBackground?: boolean;
  selectedDownloadLinks?: DownloadLink[];
};

type ViewerState = {
  isOpen: boolean;
  imageUrlList: string[];
  activeIndex: number;
};

const createClosedViewerState = (): ViewerState => ({
  isOpen: false,
  imageUrlList: [],
  activeIndex: 0,
});

type DownloadModalState = {
  isOpen: boolean;
  threadLink: string | null;
  threadTitle: string;
  downloadsData: ThreadDownloadsData | null;
  isLoading: boolean;
  errorMessage: string | null;
};

const createClosedDownloadModalState = (): DownloadModalState => ({
  isOpen: false,
  threadLink: null,
  threadTitle: "",
  downloadsData: null,
  isLoading: false,
  errorMessage: null,
});

type CookiePromptModalState = {
  isOpen: boolean;
  threadLink: string | null;
  threadTitle: string;
  draft: string;
  status: CookieProxyStatus | null;
  errorMessage: string | null;
};

const createClosedCookiePromptModalState = (): CookiePromptModalState => ({
  isOpen: false,
  threadLink: null,
  threadTitle: "",
  draft: "",
  status: null,
  errorMessage: null,
});

export {
  createClosedCookiePromptModalState,
  createClosedDownloadModalState,
  createClosedViewerState,
};

export type {
  BestDownloadOpenOptions,
  CookiePromptModalState,
  DownloadModalState,
  ViewerState,
};
