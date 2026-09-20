import { fileURLToPath } from 'node:url'

import type { StorybookConfig } from '@storybook/nextjs-vite'
import { mergeConfig } from 'vite'

const config: StorybookConfig = {
  stories: ['../src/shared/ui/**/*.stories.@(ts|tsx|mdx)', './docs/**/*.mdx'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/nextjs-vite',
  viteFinal: async (config) => {
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@shared': fileURLToPath(new URL('../src/shared', import.meta.url)),
        },
      },
    })
  },
}

export default config
