import { Avatar } from '@base-ui/react/avatar'
import { cn } from '@shared/functions/utility/cn'
import { Icon } from '@shared/ui/Icon'
import { Skeleton } from '@shared/ui/Skeleton'
import { useAttachment } from './useAttachment'
import st from './Attachment.module.scss'
import type { IAttachmentProps } from '../types/IAttachmentProps'

const Attachment = (props: IAttachmentProps) => {
  const {
    alt,
    className,
    handleImageLoad,
    handleImageLoadingStatusChange,
    isError,
    isLoaded,
    ref,
    src,
  } = useAttachment(props)

  return (
    <Avatar.Root
      className={cn(st.root, className, {
        [st.root_error]: isError,
        [st.root_loaded]: isLoaded,
      })}
      ref={ref}
    >
      <Skeleton className={st.skeleton} render={<div />} />
      <Avatar.Image
        alt={alt}
        className={st.image}
        onLoad={handleImageLoad}
        onLoadingStatusChange={handleImageLoadingStatusChange}
        src={src}
      />
      {isError && <Icon className={st.errorIcon} name="imageOff" />}
    </Avatar.Root>
  )
}

export { Attachment }
