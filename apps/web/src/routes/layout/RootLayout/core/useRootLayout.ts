import { ROBOTO_FONT } from '../static/ROBOTO_FONT'
import type { IRootLayoutProps } from '../types/IRootLayoutProps'

const useRootLayout = (props: IRootLayoutProps) => {
  const { children } = props
  const { className } = ROBOTO_FONT

  return { children, className }
}

export { useRootLayout }
