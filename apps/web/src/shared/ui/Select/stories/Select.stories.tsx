import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Select } from '../core/Select'

const meta = {
  title: 'Shared/UI/Select',
  component: Select,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    onChange: () => {},
    value: null,
    options: [
      { value: 'default', label: 'Стандартная' },
      { value: 'comfortable', label: 'Комфортная' },
      { value: 'compact', label: 'Компактная' },
    ],
  },
  argTypes: {
    className: { control: 'text' },
    onChange: { control: false },
    options: { control: 'object' },
    ref: { control: false },
    value: { control: 'text' },
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
    isRequired: {
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
    placeholder: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
  },
  render: (args) => {
    const [value, setValue] = useState<string | null>(args.value)

    return <Select {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof Select>

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

const WithIcon: TStory = {
  args: {
    icon: 'search',
  },
}

const Disabled: TStory = {
  args: {
    isDisabled: true,
  },
}

const DisabledWithValue: TStory = {
  name: 'Отключённое поле с выбранным значением',
  args: {
    hintText: 'Выбор и очистка недоступны.',
    isDisabled: true,
    value: 'default',
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

const Required: TStory = {
  args: {
    isRequired: true,
  },
}

export {
  DocsPreview,
  WithLabel,
  WithHint,
  WithPlaceholder,
  WithError,
  WithIcon,
  Disabled,
  DisabledWithValue,
  DisabledOption,
  Required,
}
export default meta
