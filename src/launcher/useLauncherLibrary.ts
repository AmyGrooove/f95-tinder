import { useEffect, useState } from 'react'
import {
  getLauncherLibrarySnapshot,
  isLauncherBridgeAvailable,
  requestLauncherDownload,
  requestLauncherInstallFolderChoice,
  requestLauncherGameDeletion,
  requestLauncherGameLaunch,
  requestLauncherLibraryClear,
  requestLauncherLibraryFolderOpen,
  requestLauncherLaunchTargetChoice,
  requestLauncherMirrorOpen,
  requestLauncherRevealGame,
  subscribeToLauncherLibrarySnapshot,
} from './runtime'
import type { LauncherLibrarySnapshot } from './types'

const createEmptyLibrarySnapshot = (): LauncherLibrarySnapshot => ({
  libraryRootPath: '',
  gamesByThreadLink: {},
})

const useLauncherLibrary = () => {
  const [librarySnapshot, setLibrarySnapshot] = useState<LauncherLibrarySnapshot>(() =>
    createEmptyLibrarySnapshot(),
  )

  useEffect(() => {
    if (!isLauncherBridgeAvailable()) {
      return
    }

    let isCancelled = false

    void (async () => {
      const nextSnapshot = await getLauncherLibrarySnapshot()
      if (!isCancelled) {
        setLibrarySnapshot(nextSnapshot)
      }
    })()

    const unsubscribe = subscribeToLauncherLibrarySnapshot((nextSnapshot) => {
      if (!isCancelled) {
        setLibrarySnapshot(nextSnapshot)
      }
    })

    return () => {
      isCancelled = true
      unsubscribe()
    }
  }, [])

  return {
    isAvailable: isLauncherBridgeAvailable(),
    librarySnapshot,
    gamesByThreadLink: librarySnapshot.gamesByThreadLink,
    libraryRootPath: librarySnapshot.libraryRootPath,
    downloadGame: requestLauncherDownload,
    chooseInstallFolder: requestLauncherInstallFolderChoice,
    deleteGameFiles: requestLauncherGameDeletion,
    launchGame: requestLauncherGameLaunch,
    clearLibrary: requestLauncherLibraryClear,
    chooseLaunchTarget: requestLauncherLaunchTargetChoice,
    openLibraryFolder: requestLauncherLibraryFolderOpen,
    openMirrorForGame: requestLauncherMirrorOpen,
    revealGame: requestLauncherRevealGame,
  }
}

export { useLauncherLibrary }
