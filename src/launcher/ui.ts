import type { LauncherGameRecord } from './types'

const isLauncherGameBusy = (launcherGame: LauncherGameRecord | null | undefined) => {
  return (
    launcherGame?.status === 'queued' ||
    launcherGame?.status === 'resolving' ||
    launcherGame?.status === 'downloading' ||
    launcherGame?.status === 'extracting'
  )
}

const formatLauncherSourceSuffix = (
  launcherGame: LauncherGameRecord | null | undefined,
) => {
  const hostLabel =
    typeof launcherGame?.lastHostLabel === 'string'
      ? launcherGame.lastHostLabel.trim()
      : ''

  return hostLabel ? ` · ${hostLabel}` : ''
}

const formatTransferSpeedLabel = (bytesPerSecond: number | null | undefined) => {
  if (
    typeof bytesPerSecond !== 'number' ||
    !Number.isFinite(bytesPerSecond) ||
    bytesPerSecond <= 0
  ) {
    return null
  }

  if (bytesPerSecond >= 1024 ** 2) {
    return `${(bytesPerSecond / 1024 ** 2).toFixed(1)} MB/s`
  }

  if (bytesPerSecond >= 1024) {
    return `${Math.round(bytesPerSecond / 1024)} KB/s`
  }

  return `${bytesPerSecond} B/s`
}

const getLauncherPrimaryActionLabel = (
  isLauncherAvailable: boolean,
  launcherGame: LauncherGameRecord | null | undefined,
) => {
  if (!isLauncherAvailable) {
    return 'Лучший'
  }

  if (!launcherGame) {
    return 'Скачать'
  }

  if (launcherGame.status === 'installed') {
    if (!launcherGame.launchTargetPath) {
      return 'Выбрать EXE'
    }

    return 'Играть'
  }

  if (launcherGame.status === 'queued') {
    return 'Отменить'
  }

  if (launcherGame.status === 'resolving') {
    return 'Отменить'
  }

  if (launcherGame.status === 'downloading') {
    return 'Отменить'
  }

  if (launcherGame.status === 'extracting') {
    return 'Отменить'
  }

  return 'Повторить'
}

const getLauncherStatusLabel = (
  launcherGame: LauncherGameRecord | null | undefined,
) => {
  if (!launcherGame) {
    return 'Нет данных'
  }

  if (launcherGame.status === 'queued') {
    return `В очереди${formatLauncherSourceSuffix(launcherGame)}`
  }
  if (launcherGame.status === 'resolving') {
    return `Подготовка${formatLauncherSourceSuffix(launcherGame)}`
  }
  if (launcherGame.status === 'downloading') {
    return typeof launcherGame.progressPercent === 'number'
      ? `Скачивание ${launcherGame.progressPercent}%${formatLauncherSourceSuffix(
          launcherGame,
        )}`
      : `Скачивание${formatLauncherSourceSuffix(launcherGame)}`
  }
  if (launcherGame.status === 'extracting') {
    return `Распаковка${formatLauncherSourceSuffix(launcherGame)}`
  }
  if (launcherGame.status === 'installed') {
    return 'Установлена'
  }
  if (launcherGame.lastHostLabel) {
    return `Ошибка · ${launcherGame.lastHostLabel}`
  }
  return 'Ошибка'
}

const getLauncherStatusText = (
  launcherGame: LauncherGameRecord | null | undefined,
) => {
  if (!launcherGame) {
    return null
  }

  if (launcherGame.status === 'installed') {
    if (!launcherGame.launchTargetName) {
      return 'Папка игры привязана'
    }

    return launcherGame.launchTargetName
      ? `Установлено: ${launcherGame.launchTargetName}`
      : 'Установлено'
  }

  if (launcherGame.errorMessage) {
    return launcherGame.errorMessage
  }

  if (launcherGame.status === 'downloading') {
    const speedLabel = formatTransferSpeedLabel(
      launcherGame.downloadSpeedBytesPerSecond,
    )
    if (speedLabel) {
      return `Скорость: ${speedLabel}`
    }
  }

  return launcherGame.message
}

export {
  getLauncherPrimaryActionLabel,
  getLauncherStatusLabel,
  getLauncherStatusText,
  isLauncherGameBusy,
}
