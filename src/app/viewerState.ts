type ViewerState =
  | {
      isOpen: false;
      imageUrlList: [];
      activeIndex: 0;
    }
  | {
      isOpen: true;
      imageUrlList: string[];
      activeIndex: number;
    };

const createClosedViewerState = (): ViewerState => ({
  isOpen: false,
  imageUrlList: [],
  activeIndex: 0,
});

export { createClosedViewerState };
export type { ViewerState };
