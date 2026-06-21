import styles from './ImageViewer.module.scss';

type ImageViewerProps = {
  currentImage: string | null;
  imageCount: number;
  imageIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

export function ImageViewer({
  currentImage,
  imageCount,
  imageIndex,
  isOpen,
  onClose,
  onNext,
  onPrevious,
}: ImageViewerProps) {
  if (!isOpen || !currentImage) {
    return null;
  }

  return (
    <div
      aria-label="Image viewer"
      aria-modal="true"
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
    >
      <div className={styles.toolbar}>
        <span>
          {imageIndex + 1} / {imageCount}
        </span>
        <button onClick={onClose} type="button">
          Close
        </button>
      </div>

      {imageCount > 1 ? (
        <button
          aria-label="Previous image"
          className={`${styles.navigation} ${styles.previous}`}
          onClick={(event) => {
            event.stopPropagation();
            onPrevious();
          }}
          type="button"
        >
          &lsaquo;
        </button>
      ) : null}

      <img
        alt=""
        className={styles.image}
        onClick={(event) => event.stopPropagation()}
        src={currentImage}
      />

      {imageCount > 1 ? (
        <button
          aria-label="Next image"
          className={`${styles.navigation} ${styles.next}`}
          onClick={(event) => {
            event.stopPropagation();
            onNext();
          }}
          type="button"
        >
          &rsaquo;
        </button>
      ) : null}
    </div>
  );
}
