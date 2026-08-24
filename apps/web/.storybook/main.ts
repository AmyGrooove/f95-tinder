import type { StorybookConfig } from '@storybook/nextjs-vite'

const config: StorybookConfig = {
  stories: ['../src/shared/ui/**/*.stories.@(ts|tsx|mdx)', './docs/**/*.mdx'],
  addons: ['@storybook/addon-docs'],
  framework: '@storybook/nextjs-vite',
}

export default config
