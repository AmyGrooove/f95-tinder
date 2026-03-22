import type { LauncherGameRecord } from './types'

const isLauncherGameBusy = (launcherGame: LauncherGameRecord | null | undefined) => {
  return (
    launcherGame?.status === 'queued' ||
    launcherGame?.status === 'resolving' ||
    launcherGame?.status === 'downloading' ||
    launcherGame?.status === 'extracting'
  )
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
    return 'В очереди'
  }

  if (launcherGame.status === 'resolving') {
    const statusMessage = launcherGame.message?.toLowerCase() ?? ''
    if (
      statusMessage.includes('captcha') ||
      statusMessage.includes('вручную') ||
      statusMessage.includes('manual')
    ) {
      return 'Жду вручную'
    }

    return 'Готовлю'
  }

  if (launcherGame.status === 'downloading') {
    return typeof launcherGame.progressPercent === 'number'
      ? `Скачиваю ${launcherGame.progressPercent}%`
      : 'Скачиваю'
  }

  if (launcherGame.status === 'extracting') {
    return 'Распаковываю'
  }

  return 'Повторить'
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

  return launcherGame.message
}

export {
  getLauncherPrimaryActionLabel,
  getLauncherStatusText,
  isLauncherGameBusy,
}
