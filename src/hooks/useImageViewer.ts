import { useCallback, useState } from "react";
import { createClosedViewerState } from "../app/viewerState";

const useImageViewer = () => {
  const [viewerState, setViewerState] = useState(() => createClosedViewerState());

  const openViewer = useCallback((imageUrlList: string[], startIndex: number) => {
    setViewerState({ isOpen: true, imageUrlList, activeIndex: startIndex });
  }, []);

  const closeViewer = useCallback(() => {
    setViewerState(createClosedViewerState());
  }, []);

  const showPreviousViewerImage = useCallback(() => {
    setViewerState((previousState) => {
      if (!previousState.isOpen || previousState.imageUrlList.length === 0) {
        return previousState;
      }

      const nextIndex =
        previousState.activeIndex <= 0
          ? previousState.imageUrlList.length - 1
          : previousState.activeIndex - 1;

      return { ...previousState, activeIndex: nextIndex };
    });
  }, []);

  const showNextViewerImage = useCallback(() => {
    setViewerState((previousState) => {
      if (!previousState.isOpen || previousState.imageUrlList.length === 0) {
        return previousState;
      }

      const nextIndex =
        previousState.activeIndex >= previousState.imageUrlList.length - 1
          ? 0
          : previousState.activeIndex + 1;

      return { ...previousState, activeIndex: nextIndex };
    });
  }, []);

  return {
    closeViewer,
    openViewer,
    showNextViewerImage,
    showPreviousViewerImage,
    viewerState,
  };
};

export { useImageViewer };
