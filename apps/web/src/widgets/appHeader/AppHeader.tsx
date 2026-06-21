import { NavLink, useNavigate } from 'react-router-dom';

import { routes } from '../../app/router/routes';
import { clearToken } from '../../entities/session/model/tokenStorage';
import { queryClient } from '../../shared/api/queryClient';
import styles from './AppHeader.module.scss';

const navigation = [
  { label: 'Swipe', to: routes.swipe },
  { label: 'Lists', to: routes.lists },
  { label: 'Settings', to: routes.settings },
] as const;

export function AppHeader() {
  const navigate = useNavigate();

  const logout = () => {
    clearToken();
    queryClient.clear();
    navigate(routes.auth, { replace: true });
  };

  return (
    <header className={styles.header}>
      <NavLink className={styles.brand} to={routes.swipe}>
        F95 Tinder
      </NavLink>
      <nav aria-label="Primary navigation" className={styles.navigation}>
        {navigation.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`
            }
            key={item.to}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button className={styles.logout} onClick={logout} type="button">
        Log out
      </button>
    </header>
  );
}
