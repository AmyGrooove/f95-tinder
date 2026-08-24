import type { IDialogViewProps } from '../../../types/IDialogViewProps'

const useDialogDesktop = (props: IDialogViewProps) => {
  const { content, isOpen, title, onOpenChange, onOpenChangeComplete } = props

  return {
    content,
    isOpen,
    title,
    onOpenChange,
    onOpenChangeComplete,
  }
}

export { useDialogDesktop }
