import type { IDialogViewProps } from '../../../types/IDialogViewProps'

const useDialogMobile = (props: IDialogViewProps) => {
  const { content, isOpen, title, onOpenChange, onOpenChangeComplete } = props

  return {
    content,
    isOpen,
    title,
    onOpenChange,
    onOpenChangeComplete,
  }
}

export { useDialogMobile }
