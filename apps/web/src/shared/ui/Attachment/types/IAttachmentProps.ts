import type { Ref } from 'react'

interface IAttachmentProps {
  src: string

  alt?: string
  className?: string
  ref?: Ref<HTMLSpanElement>
}

export type { IAttachmentProps }
