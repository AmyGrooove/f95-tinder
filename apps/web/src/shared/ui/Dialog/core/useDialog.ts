import { useUnit } from 'effector-react'
import { useViewportType } from '@shared/hooks/useViewportType'
import { clearDialog, closeDialog, $dialog } from '../stores/dialogStore'

const useDialog = () => {
  const { content, isOpen, title } = useUnit($dialog)

  const viewportType = useViewportType()

  const isMobile = viewportType === 'mobile'

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      closeDialog()
    }
  }

  const handleOpenChangeComplete = (isOpen: boolean) => {
    if (!isOpen) {
      clearDialog()
    }
  }

  return {
    content,
    isMobile,
    isOpen,
    title,
    handleOpenChange,
    handleOpenChangeComplete,
  }
}

export { useDialog }
