import type {
  GameListItemDto,
  UserGameStatus,
} from '@f95/contracts';

import { GameListItem } from '../../entities/game/ui/GameListItem';
import styles from './GameLists.module.scss';

type GameListsProps = {
  activeStatus: UserGameStatus;
  disabled: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  items: GameListItemDto[];
  onDelete: (item: GameListItemDto) => void;
  onLoadMore: () => void;
  onMove: (item: GameListItemDto, status: UserGameStatus) => void;
  onOpenImages: (images: string[], startIndex: number) => void;
  onStatusChange: (status: UserGameStatus) => void;
};

const tabs: Array<{ label: string; status: UserGameStatus }> = [
  { label: 'Bookmarks', status: 'bookmark' },
  { label: 'Trash', status: 'trash' },
  { label: 'Played', status: 'played' },
];

export function GameLists({
  activeStatus,
  disabled,
  hasNextPage,
  isFetchingNextPage,
  items,
  onDelete,
  onLoadMore,
  onMove,
  onOpenImages,
  onStatusChange,
}: GameListsProps) {
  return (
    <>
      <nav aria-label="Game lists" className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            className={tab.status === activeStatus ? styles.activeTab : ''}
            key={tab.status}
            onClick={() => onStatusChange(tab.status)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {items.length > 0 ? (
        <div className={styles.list}>
          {items.map((item) => (
            <GameListItem
              disabled={disabled}
              item={item}
              key={item.game.id}
              onDelete={() => onDelete(item)}
              onMove={(status) => onMove(item, status)}
              onOpenImages={onOpenImages}
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <h2>This list is empty</h2>
          <p>Games appear here after a swipe decision.</p>
        </div>
      )}

      {hasNextPage ? (
        <button
          className={styles.loadMore}
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
          type="button"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      ) : null}
    </>
  );
}
