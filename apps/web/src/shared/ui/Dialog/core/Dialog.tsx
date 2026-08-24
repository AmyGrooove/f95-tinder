import { DialogDesktop } from './DialogDesktop'
import { DialogMobile } from './DialogMobile'
import { useDialog } from './useDialog'
import st from './Dialog.module.scss'

const Dialog = () => {
  const {
    content,
    isMobile,
    isOpen,
    title,
    handleOpenChange,
    handleOpenChangeComplete,
  } = useDialog()

  return (
    <div className={st.root}>
      {isMobile ? (
        <DialogMobile
          content={content}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          onOpenChangeComplete={handleOpenChangeComplete}
          title={title}
        />
      ) : (
        <DialogDesktop
          content={content}
          isOpen={isOpen}
          onOpenChange={handleOpenChange}
          onOpenChangeComplete={handleOpenChangeComplete}
          title={title}
        />
      )}
    </div>
  )
}

export { Dialog }
