import type { ListType, ProcessedThreadItem } from './types'

const normalizeVersionForCompare = (value: string) => {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

const isUpdateTrackedListType = (
  value: ListType | null | undefined,
): value is 'favorite' | 'played' => {
  return value === 'favorite' || value === 'played'
}

const hasProcessedThreadItemUpdate = (
  processedItem: ProcessedThreadItem | null | undefined,
) => {
  if (!processedItem || !isUpdateTrackedListType(processedItem.listType)) {
    return false
  }

  const trackedTs =
    typeof processedItem.trackedTs === 'number' ? processedItem.trackedTs : null
  const currentTs = typeof processedItem.ts === 'number' ? processedItem.ts : null

  if (trackedTs !== null && currentTs !== null && currentTs > trackedTs) {
    return true
  }

  const trackedVersion = normalizeVersionForCompare(processedItem.trackedVersion)
  const currentVersion = normalizeVersionForCompare(processedItem.version)

  if (trackedVersion.length === 0 || currentVersion.length === 0) {
    return false
  }

  return trackedVersion !== currentVersion
}

const formatTrackedUpdateDate = (unixSeconds: number | undefined) => {
  if (
    typeof unixSeconds !== 'number' ||
    !Number.isFinite(unixSeconds) ||
    unixSeconds <= 0
  ) {
    return null
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(unixSeconds * 1000))
}

const getProcessedThreadItemUpdateLabel = (
  processedItem: ProcessedThreadItem | null | undefined,
) => {
  if (!hasProcessedThreadItemUpdate(processedItem)) {
    return null
  }

  if (!processedItem) {
    return null
  }

  const trackedVersion = processedItem.trackedVersion.trim()
  const currentVersion = processedItem.version.trim()
  if (
    trackedVersion &&
    currentVersion &&
    normalizeVersionForCompare(trackedVersion) !==
      normalizeVersionForCompare(currentVersion)
  ) {
    return `${trackedVersion} -> ${currentVersion}`
  }

  const trackedDate = formatTrackedUpdateDate(processedItem.trackedTs)
  const currentDate = formatTrackedUpdateDate(processedItem.ts)
  if (
    trackedDate &&
    currentDate &&
    processedItem.trackedTs !== processedItem.ts
  ) {
    return `${trackedDate} -> ${currentDate}`
  }

  if (currentVersion) {
    return `Текущая версия: ${currentVersion}`
  }

  if (currentDate) {
    return `Апдейт: ${currentDate}`
  }

  return 'Есть новый апдейт'
}

const countUpdatedTrackedItems = (
  threadLinkList: string[],
  processedItemsByLink: Record<string, ProcessedThreadItem>,
) => {
  return threadLinkList.reduce((count, threadLink) => {
    return count + Number(hasProcessedThreadItemUpdate(processedItemsByLink[threadLink]))
  }, 0)
}

export {
  countUpdatedTrackedItems,
  getProcessedThreadItemUpdateLabel,
  hasProcessedThreadItemUpdate,
  isUpdateTrackedListType,
}
