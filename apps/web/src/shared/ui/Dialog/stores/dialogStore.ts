import { createEvent, createStore } from 'effector'
import { INITIAL_DIALOG_STATE } from '../static/INITIAL_DIALOG_STATE'
import type { IDialogState } from '../types/IDialogState'
import type { ISetDialogProps } from '../types/ISetDialogProps'

const setDialogEvent = createEvent<ISetDialogProps>()
const closeDialogEvent = createEvent()
const clearDialogEvent = createEvent()

const $dialog = createStore<IDialogState>(INITIAL_DIALOG_STATE)
  .on(setDialogEvent, (_, dialog) => {
    return {
      content: dialog.content,
      isOpen: true,
      title: dialog.title,
    }
  })
  .on(closeDialogEvent, (dialog) => {
    return {
      content: dialog.content,
      isOpen: false,
      title: dialog.title,
    }
  })
  .on(clearDialogEvent, (dialog) => {
    if (dialog.isOpen) {
      return dialog
    }

    return INITIAL_DIALOG_STATE
  })

const setDialog = (dialog: ISetDialogProps) => {
  setDialogEvent(dialog)
}

const closeDialog = () => {
  closeDialogEvent()
}

const clearDialog = () => {
  clearDialogEvent()
}

export { $dialog, clearDialog, closeDialog, setDialog }
