import { useState } from 'react'
import type { ImageLoadingStatus } from '@base-ui/react/avatar'
import type { IAttachmentProps } from '../types/IAttachmentProps'

const useAttachment = (props: IAttachmentProps) => {
  const { alt = '', className, ref, src } = props

  const [imageLoadingStatus, setImageLoadingStatus] =
    useState<ImageLoadingStatus>('idle')

  const isError = imageLoadingStatus === 'error'
  const isLoaded = imageLoadingStatus === 'loaded'

  const handleImageLoadingStatusChange = (
    nextImageLoadingStatus: ImageLoadingStatus,
  ) => {
    setImageLoadingStatus(nextImageLoadingStatus)
  }

  return {
    alt,
    className,
    handleImageLoadingStatusChange,
    isError,
    isLoaded,
    ref,
    src,
  }
}

export { useAttachment }
