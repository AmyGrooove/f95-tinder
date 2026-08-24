interface IProcessImageOptions {
  maxBytes: number
  maxHeight: number
  maxPixels: number
  maxWidth: number
  quality: number

  resizeHeight?: number
  resizeWidth?: number
}

export type { IProcessImageOptions }
