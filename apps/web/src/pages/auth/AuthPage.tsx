import type { FormEvent } from 'react';

import { CatalogProgress } from '../../widgets/catalogProgress/CatalogProgress';
import { useAuthPage } from './hooks/useAuthPage';
import styles from './AuthPage.module.scss';

export function AuthPage() {
  const {
    createUser,
    errorMessage,
    isCreating,
    isRestoring,
    restoreSession,
    setTokenInput,
    tokenInput,
  } = useAuthPage();
  const isPending = isCreating || isRestoring;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    restoreSession();
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <span className={styles.eyebrow}>F95 Tinder</span>
        <h1>Find the next game worth your time.</h1>
        <p>
          No profile, email, or password. Create an anonymous access token or
          restore an existing session.
        </p>
      </section>

      <section className={styles.panel}>
        <div className={styles.action}>
          <div>
            <span className={styles.step}>New here</span>
            <h2>Create anonymous access</h2>
            <p>
              A new token is generated once and stored only in this browser.
            </p>
          </div>
          <button
            className={styles.primaryButton}
            disabled={isPending}
            onClick={createUser}
            type="button"
          >
            {isCreating ? 'Creating...' : 'Create user'}
          </button>
        </div>

        <div className={styles.divider}>
          <span>or restore access</span>
        </div>

        <form className={styles.action} onSubmit={handleSubmit}>
          <div>
            <label className={styles.step} htmlFor="auth-token">
              Existing token
            </label>
            <h2>Continue on this device</h2>
            <p>The token is verified before the session is restored.</p>
          </div>
          <textarea
            autoComplete="off"
            className={styles.tokenInput}
            id="auth-token"
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="Paste your access token"
            rows={3}
            spellCheck={false}
            value={tokenInput}
          />
          <button
            className={styles.secondaryButton}
            disabled={isPending || !tokenInput.trim()}
            type="submit"
          >
            {isRestoring ? 'Verifying...' : 'Restore session'}
          </button>
        </form>

        {errorMessage ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <div className={styles.catalogProgress}>
        <CatalogProgress compact />
      </div>
    </main>
  );
}
