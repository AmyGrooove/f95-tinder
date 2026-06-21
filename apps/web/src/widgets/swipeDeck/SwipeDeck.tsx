import type { GameDto, UserGameStatus } from '@f95/contracts';

import { GameCard } from '../../entities/game/ui/GameCard';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import styles from './SwipeDeck.module.scss';

type SwipeDeckProps = {
  disabled: boolean;
  game: GameDto;
  onDecision: (status: UserGameStatus) => void;
};

const directionStatus: Record<'left' | 'right' | 'up', UserGameStatus> = {
  left: 'trash',
  right: 'bookmark',
  up: 'played',
};

export function SwipeDeck({
  disabled,
  game,
  onDecision,
}: SwipeDeckProps) {
  const gesture = useSwipeGesture({
    disabled,
    onSwipe: (direction) => onDecision(directionStatus[direction]),
  });
  const activeDirection =
    -gesture.offset.y > Math.abs(gesture.offset.x)
      ? 'up'
      : gesture.offset.x < 0
        ? 'left'
        : 'right';

  return (
    <div className={styles.deck}>
      <div className={styles.backCard} aria-hidden />
      <div
        className={`${styles.frontCard} ${
          gesture.isDragging ? styles.dragging : ''
        }`}
        data-direction={gesture.isDragging ? activeDirection : undefined}
        onPointerCancel={gesture.onPointerCancel}
        onPointerDown={gesture.onPointerDown}
        onPointerMove={gesture.onPointerMove}
        onPointerUp={gesture.onPointerUp}
        style={gesture.style}
      >
        <div className={styles.gestureLabels} aria-hidden>
          <span className={styles.trash}>Trash</span>
          <span className={styles.played}>Played</span>
          <span className={styles.bookmark}>Bookmark</span>
        </div>
        <GameCard
          game={game}
          onOpenThread={() =>
            window.open(game.threadUrl, '_blank', 'noopener,noreferrer')
          }
        />
      </div>
    </div>
  );
}
