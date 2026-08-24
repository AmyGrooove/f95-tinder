import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ToggleGroup } from '../core/ToggleGroup'
import type { IToggleGroupOption } from '../types/IToggleGroupOption'

const options: IToggleGroupOption[] = [
  { value: 'filter', label: 'Фильтры', icon: 'filter' },
  { value: 'image', label: 'Изображения', icon: 'image' },
  { value: 'download', label: 'Загрузки', icon: 'download' },
]

const meta = {
  title: 'Shared/UI/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    onChange: () => {},
    options,
    value: ['filter'],
  },
  argTypes: {
    hintText: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    isDisabled: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    label: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)

    return <ToggleGroup {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof ToggleGroup>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Disabled: TStory = {
  args: {
    isDisabled: true,
  },
}

const DisabledOption: TStory = {
  args: {
    options: [
      { value: 'filter', label: 'Фильтры', icon: 'filter' },
      { value: 'image', label: 'Изображения', icon: 'image', isDisabled: true },
      { value: 'download', label: 'Загрузки', icon: 'download' },
    ],
  },
}

const WithLabel: TStory = {
  args: {
    label: 'Показывать в выдаче',
  },
}

const WithHint: TStory = {
  args: {
    hintText: 'Можно выбрать несколько вариантов.',
  },
}

export { DocsPreview, Disabled, DisabledOption, WithHint, WithLabel }
export default meta
