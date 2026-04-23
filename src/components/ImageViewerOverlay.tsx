import type { ViewerState } from "../app/downloadState";

type ImageViewerOverlayProps = {
  viewerState: ViewerState;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

const ImageViewerOverlay = ({
  viewerState,
  onClose,
  onPrevious,
  onNext,
}: ImageViewerOverlayProps) => {
  if (!viewerState.isOpen) {
    return null;
  }

  return (
    <div
      className="viewerOverlay"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div className="viewerContent">
        <div className="viewerTopBar">
          <div className="viewerCounter">
            {viewerState.activeIndex + 1} / {viewerState.imageUrlList.length}
          </div>
          <button className="button viewerCloseButton" onClick={onClose}>
            Закрыть (Esc)
          </button>
        </div>

        <div className="viewerImageWrap">
          <button
            className="viewerNavButton viewerNavLeft"
            onClick={onPrevious}
            aria-label="Previous"
          >
            ‹
          </button>

          <img
            className="viewerImage"
            src={viewerState.imageUrlList[viewerState.activeIndex]}
            alt="viewer"
            draggable={false}
          />

          <button
            className="viewerNavButton viewerNavRight"
            onClick={onNext}
            aria-label="Next"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
};

export { ImageViewerOverlay };
