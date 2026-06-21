import type { UserGameStatus } from '@f95/contracts';
import { useEffect } from 'react';

import { ApiError } from '../../shared/api/apiError';
import { CatalogProgress } from '../../widgets/catalogProgress/CatalogProgress';
import { SwipeDeck } from '../../widgets/swipeDeck/SwipeDeck';
import { useSwipeQueue } from './hooks/useSwipeQueue';
import styles from './SwipePage.module.scss';

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        'input, textarea, select, button, a, [contenteditable="true"]',
      ),
    )
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Unable to update the swipe queue.';
}

export function SwipePage() {
  const swipeQueue = useSwipeQueue();
  const isCatalogNotReady =
    swipeQueue.error instanceof ApiError &&
    swipeQueue.error.code === 'catalog_not_ready';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target) || swipeQueue.isMutating) {
        return;
      }

      const decisions: Partial<Record<string, UserGameStatus>> = {
        ArrowLeft: 'trash',
        ArrowRight: 'bookmark',
        ArrowUp: 'played',
      };
      const decision = decisions[event.key];

      if (decision && swipeQueue.currentGame) {
        event.preventDefault();
        void swipeQueue.decide(decision);
        return;
      }

      if (
        swipeQueue.canUndo &&
        (event.key === 'Backspace' || event.key.toLowerCase() === 'z')
      ) {
        event.preventDefault();
        void swipeQueue.undo();
        return;
      }

      if (event.key === 'Enter' && swipeQueue.currentGame) {
        event.preventDefault();
        window.open(
          swipeQueue.currentGame.threadUrl,
          '_blank',
          'noopener,noreferrer',
        );
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [swipeQueue]);

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Discover</span>
          <h1>Swipe</h1>
        </div>
        <p>
          {swipeQueue.queueSize} cards ready. Drag or use the keyboard.
        </p>
      </section>

      {swipeQueue.error && !isCatalogNotReady ? (
        <div className={styles.error} role="alert">
          <span>{getErrorMessage(swipeQueue.error)}</span>
          <button onClick={swipeQueue.retry} type="button">
            Retry
          </button>
        </div>
      ) : null}

      {isCatalogNotReady ? (
        <CatalogProgress onReady={swipeQueue.retry} />
      ) : swipeQueue.isLoading ? (
        <section className={styles.statePanel}>
          <span className={styles.eyebrow}>Queue</span>
          <h2>Loading games...</h2>
        </section>
      ) : swipeQueue.currentGame ? (
        <section className={styles.workspace}>
          <SwipeDeck
            disabled={swipeQueue.isMutating}
            game={swipeQueue.currentGame}
            onDecision={(status) => void swipeQueue.decide(status)}
          />

          <aside className={styles.actions}>
            <button
              className={styles.trash}
              disabled={swipeQueue.isMutating}
              onClick={() => void swipeQueue.decide('trash')}
              type="button"
            >
              <strong>Trash</strong>
              <span>Left arrow</span>
            </button>
            <button
              className={styles.played}
              disabled={swipeQueue.isMutating}
              onClick={() => void swipeQueue.decide('played')}
              type="button"
            >
              <strong>Played</strong>
              <span>Up arrow</span>
            </button>
            <button
              className={styles.bookmark}
              disabled={swipeQueue.isMutating}
              onClick={() => void swipeQueue.decide('bookmark')}
              type="button"
            >
              <strong>Bookmark</strong>
              <span>Right arrow</span>
            </button>
            <button
              className={styles.undo}
              disabled={!swipeQueue.canUndo || swipeQueue.isMutating}
              onClick={() => void swipeQueue.undo()}
              type="button"
            >
              <strong>Undo</strong>
              <span>Backspace or Z</span>
            </button>
          </aside>
        </section>
      ) : (
        <section className={styles.statePanel}>
          <span className={styles.eyebrow}>Queue complete</span>
          <h2>No more cards right now</h2>
          <p>The server has no undecided games available for this account.</p>
          <button onClick={swipeQueue.retry} type="button">
            Refresh queue
          </button>
        </section>
      )}
    </main>
  );
}
