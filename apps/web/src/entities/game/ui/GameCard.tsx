import type { GameDto } from '@f95/contracts';

import styles from './GameCard.module.scss';

type GameCardProps = {
  game: GameDto;
  onOpenThread: () => void;
};

const numberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
});

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function GameCard({ game, onOpenThread }: GameCardProps) {
  const publishedAt = formatDate(game.publishedAt);

  return (
    <article className={styles.card}>
      <header className={styles.header} data-no-swipe>
        <div>
          <p className={styles.kicker}>
            {game.creator || 'Unknown creator'}
            {game.version ? ` / ${game.version}` : ''}
          </p>
          <h1>{game.title}</h1>
        </div>
        <button
          className={styles.threadButton}
          onClick={onOpenThread}
          type="button"
        >
          Open F95 thread
        </button>
      </header>

      <div className={styles.body}>
        <section className={styles.hero}>
          <div className={styles.cover}>
            {game.coverUrl ? (
              <img alt="" draggable={false} src={game.coverUrl} />
            ) : (
              <span>No cover available</span>
            )}
          </div>

          <dl className={styles.metrics} data-no-swipe>
            <div>
              <dt>Views</dt>
              <dd>{numberFormatter.format(game.views)}</dd>
            </div>
            <div>
              <dt>Likes</dt>
              <dd>{numberFormatter.format(game.likes)}</dd>
            </div>
            <div>
              <dt>Rating</dt>
              <dd>{game.rating.toFixed(1)}</dd>
            </div>
            {publishedAt ? (
              <div>
                <dt>Published</dt>
                <dd>{publishedAt}</dd>
              </div>
            ) : null}
          </dl>

          <div className={styles.taxonomy} data-no-swipe>
            {game.prefixIds.length > 0 ? (
              <p>
                <strong>Prefixes</strong>
                {game.prefixIds.join(', ')}
              </p>
            ) : null}
            {game.tagIds.length > 0 ? (
              <p>
                <strong>Tags</strong>
                {game.tagIds.join(', ')}
              </p>
            ) : null}
          </div>
        </section>

        <section className={styles.gallery} data-no-swipe>
          <div className={styles.galleryHeading}>
            <h2>Screenshots</h2>
            <span>{game.screenshotUrls.length}</span>
          </div>
          {game.screenshotUrls.length > 0 ? (
            <div className={styles.galleryGrid}>
              {game.screenshotUrls.map((url, index) => (
                <a
                  href={url}
                  key={`${url}-${index}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <img
                    alt={`${game.title} screenshot ${index + 1}`}
                    draggable={false}
                    loading="lazy"
                    src={url}
                  />
                </a>
              ))}
            </div>
          ) : (
            <p className={styles.emptyGallery}>No screenshots available.</p>
          )}
        </section>
      </div>
    </article>
  );
}
