type StartupSplashProps = {
  isVisible: boolean
  isBusy: boolean
  statusText: string
  metaText: string
  progressPercent: number | null
  catalogCount: number
  canDismiss: boolean
  onDismiss: () => void
}

const StartupSplash = ({
  isVisible,
  isBusy,
  statusText,
  metaText,
  progressPercent,
  catalogCount,
  canDismiss,
  onDismiss,
}: StartupSplashProps) => {
  if (!isVisible) {
    return null
  }

  return (
    <div className="startupSplash" aria-live="polite" aria-busy={isBusy}>
      <div className="startupSplashPanel panel">
        <div className="startupSplashHeader">
          <div className="startupSplashEyebrow">Startup Sync</div>

          {canDismiss ? (
            <button
              className="startupSplashDismissButton"
              type="button"
              onClick={onDismiss}
              aria-label="Скрыть стартовую синхронизацию"
              title="Скрыть"
            >
              ✕
            </button>
          ) : null}
        </div>
        <div className="startupSplashHero">
          <div className="startupSplashPulse" aria-hidden />
          <div className="startupSplashHeroCopy">
            <div className="startupSplashTitle">F95 Tinder</div>
            <div className="startupSplashSubtitle">{statusText}</div>
          </div>
        </div>
        <div className="startupSplashText">{metaText}</div>
        <div className="startupSplashTrack">
          <div
            className={`startupSplashFill ${
              progressPercent === null ? "startupSplashFillIndeterminate" : ""
            }`}
            style={
              progressPercent === null
                ? undefined
                : { width: `${progressPercent}%` }
            }
          />
        </div>
        <div className="startupSplashMetaRow">
          <span>
            {progressPercent === null ? "Подготовка..." : `${progressPercent}%`}
          </span>
          <span>{`Игр в памяти: ${catalogCount}`}</span>
        </div>

        {canDismiss ? (
          <div className="startupSplashActions">
            <button
              className="startupSplashContinueButton"
              type="button"
              onClick={onDismiss}
            >
              Продолжить в приложение
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { StartupSplash }
