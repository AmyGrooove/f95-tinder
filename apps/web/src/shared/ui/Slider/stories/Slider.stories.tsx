import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Slider } from '../core/Slider'

const meta = {
  title: 'Shared/UI/Slider',
  component: Slider,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    max: 100,
    min: 0,
    step: 1,
    value: 0,
    onChange: () => {},
  },
  argTypes: {
    isDisabled: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    max: {
      control: { type: 'number' },
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '100' },
      },
    },
    min: {
      control: { type: 'number' },
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '0' },
      },
    },
    step: {
      control: { type: 'number' },
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '1' },
      },
    },
    value: {
      control: { type: 'number' },
      table: {
        type: { summary: 'number' },
      },
    },
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)

    return <Slider {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof Slider>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const WithLabel: TStory = {
  args: {
    label: 'Значение',
  },
}

const WithHint: TStory = {
  args: {
    hintText: 'Выберите значение от 0 до 100.',
  },
}

const WithError: TStory = {
  args: {
    errorText: 'Выберите корректное значение.',
  },
}

const Disabled: TStory = {
  args: {
    isDisabled: true,
  },
}

export { DocsPreview, WithLabel, WithHint, WithError, Disabled }
export default meta
