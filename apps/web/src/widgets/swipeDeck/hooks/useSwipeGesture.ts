import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useMemo, useRef, useState } from 'react';

type SwipeDirection = 'left' | 'right' | 'up';

type SwipeGestureOptions = {
  disabled?: boolean;
  onSwipe: (direction: SwipeDirection) => void;
};

const SWIPE_THRESHOLD = 90;

export function useSwipeGesture({
  disabled = false,
  onSwipe,
}: SwipeGestureOptions) {
  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = pointerIdRef.current !== null;

  const reset = () => {
    pointerIdRef.current = null;
    setOffset({ x: 0, y: 0 });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;

    if (
      disabled ||
      event.button !== 0 ||
      target.closest('button, a, input, textarea, select, [data-no-swipe]')
    ) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    originRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    setOffset({
      x: event.clientX - originRef.current.x,
      y: event.clientY - originRef.current.y,
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    const finalOffset = {
      x: event.clientX - originRef.current.x,
      y: event.clientY - originRef.current.y,
    };
    const horizontalDistance = Math.abs(finalOffset.x);
    const upwardDistance = -finalOffset.y;

    if (
      upwardDistance >= SWIPE_THRESHOLD &&
      upwardDistance > horizontalDistance
    ) {
      reset();
      onSwipe('up');
      return;
    }

    if (horizontalDistance >= SWIPE_THRESHOLD) {
      const direction = finalOffset.x < 0 ? 'left' : 'right';
      reset();
      onSwipe(direction);
      return;
    }

    reset();
  };

  const style = useMemo<CSSProperties>(
    () => ({
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${offset.x / 28}deg)`,
      transition: isDragging ? 'none' : undefined,
    }),
    [isDragging, offset.x, offset.y],
  );

  return {
    isDragging,
    offset,
    onPointerCancel: reset,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    style,
  };
}
