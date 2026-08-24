import { AppProviders } from './AppProviders'
import { GlassDistortionFilter } from './GlassDistortionFilter'

import { ROBOTO_FONT } from '../static/ROBOTO_FONT'

import type { IRootLayoutProps } from '../types/IRootLayoutProps'

const RootLayout = (props: IRootLayoutProps) => {
  const { children } = props

  return (
    <html className={ROBOTO_FONT.className} lang="ru">
      <body>
        <GlassDistortionFilter />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}

export { RootLayout }
