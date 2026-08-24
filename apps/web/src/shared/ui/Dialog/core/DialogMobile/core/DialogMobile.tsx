import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer'
import { Text } from '@shared/ui/Text'
import { useDialogMobile } from './useDialogMobile'
import st from './DialogMobile.module.scss'
import type { IDialogViewProps } from '../../../types/IDialogViewProps'

const DialogMobile = (props: IDialogViewProps) => {
  const { content, isOpen, title, onOpenChange, onOpenChangeComplete } =
    useDialogMobile(props)

  return (
    <DrawerPrimitive.Root
      onOpenChange={onOpenChange}
      onOpenChangeComplete={onOpenChangeComplete}
      open={isOpen}
      swipeDirection="down"
    >
      <DrawerPrimitive.Portal keepMounted>
        <DrawerPrimitive.Backdrop className={st.backdrop} />
        <DrawerPrimitive.Viewport className={st.viewport}>
          <DrawerPrimitive.Popup className={st.root}>
            <span className={st.dragHandle} />
            <header className={st.header}>
              <Text
                fontSize={20}
                render={<DrawerPrimitive.Title />}
                weight={700}
                maxLines={2}
              >
                {title}
              </Text>
            </header>
            <DrawerPrimitive.Content className={st.content} tabIndex={-1}>
              {content}
            </DrawerPrimitive.Content>
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  )
}

export { DialogMobile }
