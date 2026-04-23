import type { ListType, SwipeSortMode } from "../f95/types";

const DOWNLOAD_PRELOAD_LIMIT = 4;
const SWIPE_HORIZONTAL_THRESHOLD_PX = 120;
const SWIPE_VERTICAL_THRESHOLD_PX = 110;
const SWIPE_MAX_TILT_DEG = 12;

type SwipeGestureState = {
  isDragging: boolean;
  offsetX: number;
  offsetY: number;
};

type SwipePointerState = {
  pointerId: number | null;
  startX: number;
  startY: number;
};

type SwipeFilterOption = {
  id: number;
  label: string;
  count: number;
};

type SwipeQueueSnapshot = {
  visibleCount: number;
  tagOptions: SwipeFilterOption[];
  prefixOptions: SwipeFilterOption[];
};

const createIdleSwipeGestureState = (): SwipeGestureState => ({
  isDragging: false,
  offsetX: 0,
  offsetY: 0,
});

const createIdleSwipePointerState = (): SwipePointerState => ({
  pointerId: null,
  startX: 0,
  startY: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

const isTextInputFocused = () => {
  const activeElement = document.activeElement;
  if (!activeElement) {
    return false;
  }

  const elementTagName = activeElement.tagName;
  if (
    elementTagName === "INPUT" ||
    elementTagName === "TEXTAREA" ||
    elementTagName === "SELECT"
  ) {
    return true;
  }

  return false;
};

const isInteractiveSwipeTarget = (target: EventTarget | null) => {
  return target instanceof HTMLElement
    ? Boolean(
        target.closest(
          "button, a, input, textarea, select, label, [data-no-swipe='true']",
        ),
      )
    : false;
};

const resolveSwipeActionFromOffset = (
  offsetX: number,
  offsetY: number,
): ListType | null => {
  const absoluteX = Math.abs(offsetX);
  const upwardOffset = -offsetY;

  if (
    upwardOffset >= SWIPE_VERTICAL_THRESHOLD_PX &&
    upwardOffset >= absoluteX * 0.85
  ) {
    return "played";
  }

  if (absoluteX >= SWIPE_HORIZONTAL_THRESHOLD_PX) {
    return offsetX > 0 ? "favorite" : "trash";
  }

  return null;
};

const formatCompactNumber = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return compactNumberFormatter.format(value);
};

const formatThreadDateLabel = (value: string | undefined) => {
  if (!value) {
    return "Не указана";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return shortDateFormatter.format(parsedDate);
};

const getSwipeActionCopy = (action: ListType | null) => {
  switch (action) {
    case "favorite":
      return { label: "В закладки", hint: "-> Right", className: "favorite" };
    case "trash":
      return { label: "В мусор", hint: "<- Left", className: "trash" };
    case "played":
      return { label: "Играл", hint: "^ Up", className: "played" };
    default:
      return null;
  }
};

const SWIPE_SORT_OPTIONS = [
  { value: "date", label: "По дате" },
  { value: "views", label: "По просмотрам" },
] as const;

const SWIPE_ORDER_OPTIONS: Array<{ value: SwipeSortMode; label: string }> = [
  { value: "date", label: "По дате" },
  { value: "views", label: "По просмотрам" },
  { value: "interest", label: "По весу" },
];

export {
  clamp,
  createIdleSwipeGestureState,
  createIdleSwipePointerState,
  DOWNLOAD_PRELOAD_LIMIT,
  formatCompactNumber,
  formatThreadDateLabel,
  getSwipeActionCopy,
  isInteractiveSwipeTarget,
  isTextInputFocused,
  resolveSwipeActionFromOffset,
  SWIPE_HORIZONTAL_THRESHOLD_PX,
  SWIPE_MAX_TILT_DEG,
  SWIPE_ORDER_OPTIONS,
  SWIPE_SORT_OPTIONS,
  SWIPE_VERTICAL_THRESHOLD_PX,
};

export type {
  SwipeFilterOption,
  SwipeGestureState,
  SwipePointerState,
  SwipeQueueSnapshot,
};
