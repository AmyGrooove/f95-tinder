import { AppProviders } from './AppProviders'
import { GlassDistortionFilter } from './GlassDistortionFilter'

import { useRootLayout } from './useRootLayout'

import type { IRootLayoutProps } from '../types/IRootLayoutProps'

const RootLayout = (props: IRootLayoutProps) => {
  const { children, className } = useRootLayout(props)

  return (
    <html className={className} lang="ru">
      <body>
        <GlassDistortionFilter />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}

export { RootLayout }
