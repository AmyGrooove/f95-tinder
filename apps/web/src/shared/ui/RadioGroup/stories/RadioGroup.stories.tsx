import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { RadioGroup } from '../core/RadioGroup'

const options = [
  { value: 'default', label: 'Стандартная' },
  { value: 'comfortable', label: 'Комфортная' },
  { value: 'compact', label: 'Компактная' },
]

const meta = {
  title: 'Shared/UI/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    onChange: () => {},
    options,
    value: 'default',
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
    value: {
      control: { type: 'select' },
      options: options.map((option) => {
        return option.value
      }),
      table: {
        type: { summary: 'string' },
        defaultValue: { summary: 'default' },
      },
    },
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)

    return <RadioGroup {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof RadioGroup>

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
      { value: 'default', label: 'Стандартная' },
      { value: 'comfortable', label: 'Комфортная', isDisabled: true },
      { value: 'compact', label: 'Компактная' },
    ],
  },
}

const WithLabel: TStory = {
  args: {
    label: 'Можно изменить позже',
  },
}

const WithHint: TStory = {
  args: {
    hintText: 'Можно изменить позже',
  },
}

export { DocsPreview, Disabled, DisabledOption, WithHint, WithLabel }
export default meta
