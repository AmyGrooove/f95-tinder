import type {
  GameListItemDto,
  UserGameStatus,
} from '@f95/contracts';

import styles from './GameListItem.module.scss';

type GameListItemProps = {
  disabled: boolean;
  item: GameListItemDto;
  onDelete: () => void;
  onMove: (status: UserGameStatus) => void;
  onOpenImages: (images: string[], startIndex: number) => void;
};

const statuses: UserGameStatus[] = ['bookmark', 'trash', 'played'];

export function GameListItem({
  disabled,
  item,
  onDelete,
  onMove,
  onOpenImages,
}: GameListItemProps) {
  const hasCover = Boolean(item.game.coverUrl);
  const images = [
    ...(hasCover ? [item.game.coverUrl] : []),
    ...item.game.screenshotUrls,
  ];

  return (
    <article className={styles.item}>
      <button
        aria-label={`View images for ${item.game.title}`}
        className={styles.cover}
        disabled={images.length === 0}
        onClick={() => onOpenImages(images, 0)}
        type="button"
      >
        {item.game.coverUrl ? (
          <img alt="" loading="lazy" src={item.game.coverUrl} />
        ) : (
          <span>No cover</span>
        )}
      </button>

      <div className={styles.content}>
        <div className={styles.titleRow}>
          <div>
            <p>
              {item.game.creator || 'Unknown creator'}
              {item.game.version ? ` / ${item.game.version}` : ''}
            </p>
            <h2>{item.game.title}</h2>
          </div>
          <a href={item.game.threadUrl} rel="noreferrer" target="_blank">
            Open F95
          </a>
        </div>

        <div className={styles.meta}>
          <span>{item.game.views.toLocaleString()} views</span>
          <span>{item.game.likes.toLocaleString()} likes</span>
          <span>{item.game.rating.toFixed(1)} rating</span>
          <span>{item.game.screenshotUrls.length} screenshots</span>
        </div>

        {item.game.screenshotUrls.length > 0 ? (
          <div className={styles.screenshots}>
            {item.game.screenshotUrls.slice(0, 4).map((url, index) => (
              <button
                key={`${url}-${index}`}
                onClick={() =>
                  onOpenImages(images, index + (hasCover ? 1 : 0))
                }
                type="button"
              >
                <img
                  alt={`${item.game.title} screenshot ${index + 1}`}
                  loading="lazy"
                  src={url}
                />
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.actions}>
          <label>
            Move to
            <select
              disabled={disabled}
              onChange={(event) =>
                onMove(event.target.value as UserGameStatus)
              }
              value={item.status}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <button
            className={styles.deleteButton}
            disabled={disabled}
            onClick={onDelete}
            type="button"
          >
            Remove decision
          </button>
        </div>
      </div>
    </article>
  );
}
