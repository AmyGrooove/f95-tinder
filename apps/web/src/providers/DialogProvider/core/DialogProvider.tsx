import { Dialog } from '@shared/ui/Dialog'
import { useDialogProvider } from './useDialogProvider'
import type { IDialogProviderProps } from '../types/IDialogProviderProps'

const DialogProvider = (props: IDialogProviderProps) => {
  const { children } = useDialogProvider(props)

  return (
    <>
      {children}
      <Dialog />
    </>
  )
}

export { DialogProvider }
