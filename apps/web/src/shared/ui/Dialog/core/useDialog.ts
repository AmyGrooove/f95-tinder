import { useState } from 'react'
import { useUnit } from 'effector-react'
import { isNil } from '@shared/functions/checks/isNil'
import { useViewportType } from '@shared/hooks/useViewportType'
import type { TViewportType } from '@shared/hooks/useViewportType'
import { clearDialog, closeDialog, $dialog } from '../stores/dialogStore'

const useDialog = () => {
  const { content, isOpen, title } = useUnit($dialog)

  const viewportType = useViewportType()
  const [dialogViewportType, setDialogViewportType] = useState<TViewportType>()

  const isMobile = (dialogViewportType ?? viewportType) === 'mobile'

  if (isOpen && isNil(dialogViewportType)) {
    setDialogViewportType(viewportType)
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      closeDialog()
    }
  }

  const handleOpenChangeComplete = (isNextOpen: boolean) => {
    if (!isNextOpen) {
      clearDialog()

      if (!isOpen) {
        setDialogViewportType(undefined)
      }
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
