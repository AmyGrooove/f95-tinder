import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Icon } from '@shared/ui/Icon'
import { Text } from '@shared/ui/Text'
import { useDialogDesktop } from './useDialogDesktop'
import st from './DialogDesktop.module.scss'
import type { IDialogViewProps } from '../../../types/IDialogViewProps'

const DialogDesktop = (props: IDialogViewProps) => {
  const { content, isOpen, title, onOpenChange, onOpenChangeComplete } =
    useDialogDesktop(props)

  return (
    <DialogPrimitive.Root
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      open={isOpen}
    >
      <DialogPrimitive.Portal keepMounted>
        <DialogPrimitive.Backdrop className={st.backdrop} />
        <DialogPrimitive.Viewport className={st.viewport}>
          <DialogPrimitive.Popup className={st.root}>
            <header className={st.header}>
              <Text
                maxLines={2}
                fontSize={20}
                render={<DialogPrimitive.Title />}
                weight={700}
              >
                {title}
              </Text>
              <DialogPrimitive.Close
                render={
                  <button className={st.closeButton}>
                    <Icon name="x" size={40} />
                  </button>
                }
              />
            </header>
            <div className={st.content} tabIndex={-1}>
              {content}
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export { DialogDesktop }
