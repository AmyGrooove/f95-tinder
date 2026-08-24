import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Input } from '../core/Input'

const meta = {
  title: 'Shared/UI/Input',
  component: Input,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    onChange: () => {},
    type: 'text',
    value: '',
  },
  argTypes: {
    label: {
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
    errorText: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    icon: {
      control: { type: 'select' },
      options: ['search', 'eye', 'info'],
      table: {
        type: { summary: 'TIconName' },
      },
    },
    isDisabled: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    type: {
      control: { type: 'radio' },
      options: ['text', 'password'],
      table: {
        type: { summary: 'TInputType' },
        defaultValue: { summary: 'text' },
      },
    },
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)

    return <Input {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof Input>

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

const WithIcon: TStory = {
  args: {
    icon: 'search',
  },
}

const WithError: TStory = {
  args: {
    errorText: 'Введите корректный email.',
  },
}

const Password: TStory = {
  args: {
    type: 'password',
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
  Disabled,
  Password,
  WithError,
  WithIcon,
}
export default meta
