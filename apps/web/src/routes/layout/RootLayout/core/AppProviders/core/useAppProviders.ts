import type { IAppProvidersProps } from '../types/IAppProvidersProps'

const useAppProviders = (props: IAppProvidersProps) => {
  const { children } = props

  return {
    children,
  }
}

export { useAppProviders }
