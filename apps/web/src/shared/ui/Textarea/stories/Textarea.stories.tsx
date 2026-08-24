import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Textarea } from '../core/Textarea'

const meta = {
  title: 'Shared/UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    onChange: () => {},
    value: '',
  },
  argTypes: {
    errorText: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
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
    const [value, setValue] = useState('')

    return <Textarea {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof Textarea>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const WithLabel: TStory = {
  args: {
    label: 'Email',
  },
}

const WithHint: TStory = {
  args: {
    hintText: 'Мы не отправляем спам.',
  },
}

const WithPlaceholder: TStory = {
  args: {
    placeholder: 'Найти аниме',
  },
}

const WithError: TStory = {
  args: {
    errorText: 'Введите корректный email.',
  },
}

const Disabled: TStory = {
  args: {
    isDisabled: true,
  },
}

export {
  DocsPreview,
  WithLabel,
  WithHint,
  WithPlaceholder,
  WithError,
  Disabled,
}
export default meta
