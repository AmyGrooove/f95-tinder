import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CheckboxGroup } from '../core/CheckboxGroup'

const options = [
  { value: 'email', label: 'Получать уведомления на почту' },
  { value: 'push', label: 'Получать push-уведомления' },
  { value: 'messages', label: 'Получать уведомления о новых сообщениях' },
]

const meta = {
  title: 'Shared/UI/CheckboxGroup',
  component: CheckboxGroup,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    onChange: () => {},
    options,
    value: ['email'],
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

    return <CheckboxGroup {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof CheckboxGroup>

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
      { value: 'email', label: 'Получать уведомления на почту' },
      {
        value: 'push',
        label: 'Получать push-уведомления',
        isDisabled: true,
      },
      { value: 'messages', label: 'Получать уведомления о новых сообщениях' },
    ],
  },
}

const WithLabel: TStory = {
  args: {
    label: 'Настройки уведомлений',
  },
}

const WithHint: TStory = {
  args: {
    hintText: 'Можно изменить позже в настройках профиля.',
  },
}

export { DocsPreview, Disabled, DisabledOption, WithHint, WithLabel }
export default meta
