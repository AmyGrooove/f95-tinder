import { useState } from 'react'
import type { ImageLoadingStatus } from '@base-ui/react/avatar'
import type { SyntheticEvent } from 'react'
import type { IAttachmentProps } from '../types/IAttachmentProps'

const useAttachment = (props: IAttachmentProps) => {
  const { alt = '', className, ref, src } = props

  const [imageLoadingStatus, setImageLoadingStatus] =
    useState<ImageLoadingStatus>('idle')
  const [isImageReady, setIsImageReady] = useState(false)

  const isError = imageLoadingStatus === 'error'
  const isLoaded = imageLoadingStatus === 'loaded' && isImageReady

  const handleImageLoad = async (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget
    const imageSource = image.currentSrc

    await image.decode().catch(() => {
      return undefined
    })

    if (image.currentSrc !== imageSource) {
      return
    }

    setIsImageReady(true)
  }

  const handleImageLoadingStatusChange = (
    nextImageLoadingStatus: ImageLoadingStatus,
  ) => {
    setImageLoadingStatus(nextImageLoadingStatus)

    if (nextImageLoadingStatus !== 'loaded') {
      setIsImageReady(false)
    }
  }

  return {
    alt,
    className,
    handleImageLoad,
    handleImageLoadingStatusChange,
    isError,
    isLoaded,
    ref,
    src,
  }
}

export { useAttachment }
