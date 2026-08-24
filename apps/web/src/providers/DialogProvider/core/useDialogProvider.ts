import type { IDialogProviderProps } from '../types/IDialogProviderProps'

const useDialogProvider = (props: IDialogProviderProps) => {
  const { children } = props

  return {
    children,
  }
}

export { useDialogProvider }
