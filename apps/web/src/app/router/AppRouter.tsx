import { useSyncExternalStore } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import {
  getToken,
  subscribeToToken,
} from '../../entities/session/model/tokenStorage';
import { useSessionQuery } from '../../entities/session/api/session.queries';
import { AuthPage } from '../../pages/auth/AuthPage';
import { ListsPage } from '../../pages/lists/ListsPage';
import { SettingsPage } from '../../pages/settings/SettingsPage';
import { SwipePage } from '../../pages/swipe/SwipePage';
import { AppHeader } from '../../widgets/appHeader/AppHeader';
import { routes } from './routes';

function RoutePlaceholder({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="app-shell">
      <section className="app-panel">
        <span className="app-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </section>
    </main>
  );
}

function AuthenticatedRoute() {
  const location = useLocation();
  const token = useSyncExternalStore(subscribeToToken, getToken, () => null);
  const sessionQuery = useSessionQuery(Boolean(token));

  if (!token) {
    return (
      <Navigate
        replace
        state={{ from: location.pathname }}
        to={routes.auth}
      />
    );
  }

  if (sessionQuery.isPending) {
    return (
      <RoutePlaceholder
        eyebrow="Session"
        title="Restoring access..."
      />
    );
  }

  if (sessionQuery.isError) {
    return (
      <main className="app-shell">
        <section className="app-panel" role="alert">
          <span className="app-eyebrow">Session unavailable</span>
          <h1>Unable to verify access</h1>
          <p className="app-muted">
            Check the connection and reload the page.
          </p>
        </section>
      </main>
    );
  }

  return <Outlet />;
}

function AuthenticatedLayout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path={routes.auth} element={<AuthPage />} />
      <Route element={<AuthenticatedRoute />}>
        <Route element={<AuthenticatedLayout />}>
          <Route
            path={routes.swipe}
            element={<SwipePage />}
          />
          <Route
            path={routes.lists}
            element={<ListsPage />}
          />
          <Route path={routes.settings} element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="/" element={<Navigate replace to={routes.swipe} />} />
      <Route path="*" element={<Navigate replace to={routes.swipe} />} />
    </Routes>
  );
}
