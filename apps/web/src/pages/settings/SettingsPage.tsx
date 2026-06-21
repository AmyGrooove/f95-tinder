import { useState } from 'react';

import { ApiError } from '../../shared/api/apiError';
import { useTokenQuery } from './api/token.query';
import styles from './SettingsPage.module.scss';

export function SettingsPage() {
  const tokenQuery = useTokenQuery();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  const copyToken = async () => {
    if (!tokenQuery.data?.token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(tokenQuery.data.token);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const errorMessage =
    tokenQuery.error instanceof ApiError
      ? tokenQuery.error.message
      : 'Unable to load the access token.';

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <span className={styles.eyebrow}>Account</span>
        <h1>Settings</h1>
        <p>
          This token is the only way to restore your lists on another browser.
        </p>
      </section>

      <section className={styles.panel}>
        <div>
          <h2>Access token</h2>
          <p className={styles.description}>
            Keep it private. Anyone with this token can access your session.
          </p>
        </div>

        {tokenQuery.isPending ? (
          <p className={styles.status}>Decrypting token...</p>
        ) : null}

        {tokenQuery.isError ? (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        ) : null}

        {tokenQuery.data ? (
          <>
            <textarea
              aria-label="Access token"
              className={styles.token}
              readOnly
              rows={4}
              spellCheck={false}
              value={tokenQuery.data.token}
            />
            <div className={styles.actions}>
              <button
                className={styles.copyButton}
                onClick={copyToken}
                type="button"
              >
                {copyState === 'copied' ? 'Copied' : 'Copy token'}
              </button>
              {copyState === 'failed' ? (
                <span className={styles.copyError} role="status">
                  Clipboard access failed. Select and copy the token manually.
                </span>
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
