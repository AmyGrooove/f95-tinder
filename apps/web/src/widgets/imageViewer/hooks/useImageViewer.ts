import { useCallback, useEffect, useState } from 'react';

type ViewerState = {
  images: string[];
  index: number;
};

export function useImageViewer() {
  const [state, setState] = useState<ViewerState | null>(null);

  const close = useCallback(() => setState(null), []);

  const open = useCallback((images: string[], startIndex = 0) => {
    const normalizedImages = images.filter(Boolean);

    if (normalizedImages.length === 0) {
      return;
    }

    setState({
      images: normalizedImages,
      index: Math.min(Math.max(startIndex, 0), normalizedImages.length - 1),
    });
  }, []);

  const showPrevious = useCallback(() => {
    setState((current) =>
      current
        ? {
            ...current,
            index:
              (current.index - 1 + current.images.length) %
              current.images.length,
          }
        : current,
    );
  }, []);

  const showNext = useCallback(() => {
    setState((current) =>
      current
        ? {
            ...current,
            index: (current.index + 1) % current.images.length,
          }
        : current,
    );
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showPrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close, showNext, showPrevious, state]);

  return {
    close,
    currentImage: state?.images[state.index] ?? null,
    imageCount: state?.images.length ?? 0,
    imageIndex: state?.index ?? 0,
    isOpen: state !== null,
    open,
    showNext,
    showPrevious,
  };
}
