import type { SettingsTab } from "./SettingsPage";
import type { PageType } from "../app/routing";

type AppTopBarProps = {
  pageType: PageType;
  errorMessage: string | null;
  cookieRefreshNoticeMessage: string | null;
  onSetPage: (pageType: PageType, settingsTab?: SettingsTab | null) => void;
};

const AppTopBar = ({
  pageType,
  errorMessage,
  cookieRefreshNoticeMessage,
  onSetPage,
}: AppTopBarProps) => {
  return (
    <div className="topBar">
      <div className="topBarGrid">
        <div />

        <div className="topBarButtons">
          <button
            className={`button ${pageType === "swipe" ? "navButtonActive" : ""}`}
            onClick={() => onSetPage("swipe")}
          >
            Свайп
          </button>
          <button
            className={`button ${pageType === "lists" ? "navButtonActive" : ""}`}
            onClick={() => onSetPage("lists")}
          >
            Списки
          </button>
          <button
            className={`button ${pageType === "dashboard" ? "navButtonActive" : ""}`}
            onClick={() => onSetPage("dashboard")}
          >
            Дашборд
          </button>
          <button
            className={`button ${pageType === "settings" ? "navButtonActive" : ""}`}
            onClick={() => onSetPage("settings")}
          >
            Настройки
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="smallText" style={{ marginTop: 8 }}>
          {errorMessage}
        </div>
      ) : null}

      {cookieRefreshNoticeMessage ? (
        <div className="topBarNotice">
          <div className="topBarNoticeText">{cookieRefreshNoticeMessage}</div>
          <button
            className="button topBarNoticeButton"
            type="button"
            onClick={() => onSetPage("settings", "cookies")}
          >
            Перейти в Куки
          </button>
        </div>
      ) : null}
    </div>
  );
};

export { AppTopBar };
