type StartupSplashProps = {
  isVisible: boolean;
  isBusy: boolean;
  statusText: string;
  metaText: string;
  progressPercent: number | null;
  catalogCount: number;
};

const StartupSplash = ({
  isVisible,
  isBusy,
  statusText,
  metaText,
  progressPercent,
  catalogCount,
}: StartupSplashProps) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="startupSplash" aria-live="polite" aria-busy={isBusy}>
      <div className="startupSplashPanel panel">
        <div className="startupSplashEyebrow">Startup Sync</div>
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
      </div>
    </div>
  );
};

export { StartupSplash };
