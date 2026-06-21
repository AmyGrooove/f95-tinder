import type { UserGameStatus } from '@f95/contracts';
import { useState } from 'react';

import { ApiError } from '../../shared/api/apiError';
import { GameLists } from '../../widgets/gameLists/GameLists';
import { ImageViewer } from '../../widgets/imageViewer/ImageViewer';
import { useImageViewer } from '../../widgets/imageViewer/hooks/useImageViewer';
import { useGameList } from './hooks/useGameList';
import styles from './ListsPage.module.scss';

function getErrorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Unable to update the game list.';
}

export function ListsPage() {
  const [activeStatus, setActiveStatus] =
    useState<UserGameStatus>('bookmark');
  const gameList = useGameList(activeStatus);
  const imageViewer = useImageViewer();

  return (
    <main className={styles.page}>
      <section className={styles.heading}>
        <span className={styles.eyebrow}>Library</span>
        <h1>Your lists</h1>
        <p>Review saved games, move them between lists, or remove a decision.</p>
      </section>

      {gameList.error ? (
        <div className={styles.error} role="alert">
          <span>{getErrorMessage(gameList.error)}</span>
          <button onClick={gameList.retry} type="button">
            Retry
          </button>
        </div>
      ) : null}

      {gameList.isLoading ? (
        <section className={styles.loading}>Loading list...</section>
      ) : (
        <GameLists
          activeStatus={activeStatus}
          disabled={gameList.isMutating}
          hasNextPage={gameList.hasNextPage}
          isFetchingNextPage={gameList.isFetchingNextPage}
          items={gameList.items}
          onDelete={(item) => void gameList.deleteGame(item)}
          onLoadMore={() => void gameList.fetchNextPage()}
          onMove={(item, status) => void gameList.moveGame(item, status)}
          onOpenImages={imageViewer.open}
          onStatusChange={setActiveStatus}
        />
      )}

      <ImageViewer
        currentImage={imageViewer.currentImage}
        imageCount={imageViewer.imageCount}
        imageIndex={imageViewer.imageIndex}
        isOpen={imageViewer.isOpen}
        onClose={imageViewer.close}
        onNext={imageViewer.showNext}
        onPrevious={imageViewer.showPrevious}
      />
    </main>
  );
}
