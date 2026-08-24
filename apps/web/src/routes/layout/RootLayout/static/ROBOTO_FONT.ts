import { Roboto } from 'next/font/google'

const ROBOTO_FONT = Roboto({
  display: 'swap',
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '700'],
})

export { ROBOTO_FONT }
