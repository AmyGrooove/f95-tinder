import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Tabs } from '../core/Tabs'

const meta = {
  title: 'Shared/UI/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  args: {
    items: [
      {
        value: 'overview',
        label: 'Обзор',
      },
      {
        value: 'activity',
        label: 'Активность',
      },
      {
        value: 'settings',
        label: 'Настройки',
      },
    ],
    onChange: () => {},
    value: 'overview',
  },
  argTypes: {
    items: {
      control: { type: 'object' },
      table: {
        type: { summary: 'ITabItem[]' },
      },
    },
    value: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)

    return <Tabs {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof Tabs>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Disabled: TStory = {
  args: {
    items: [
      {
        value: 'overview',
        label: 'Обзор',
      },
      {
        value: 'disabled',
        label: 'Недоступно',
        isDisabled: true,
      },
      {
        value: 'settings',
        label: 'Настройки',
      },
    ],
  },
}

const WithIcons: TStory = {
  args: {
    items: [
      {
        value: 'overview',
        label: 'Обзор',
        icon: 'eye',
      },
      {
        value: 'activity',
        label: 'Активность',
        icon: 'info',
      },
      {
        value: 'settings',
        label: 'Настройки',
        icon: 'filter',
      },
    ],
  },
}

export { DocsPreview, Disabled, WithIcons }
export default meta
