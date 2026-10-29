import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Box } from '@shared/ui/Box'
import { Switch } from '../core/Switch'

const meta = {
  title: 'Shared/UI/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    label: 'Заголовок',
    onChange: () => {},
    isChecked: false,
  },
  argTypes: {
    isChecked: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
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
    const [isChecked, setIsChecked] = useState(args.isChecked)

    return <Switch {...args} onChange={setIsChecked} isChecked={isChecked} />
  },
} satisfies Meta<typeof Switch>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Disabled: TStory = {
  render: (args) => {
    return (
      <Box alignItems="start" flexDirection="column" gap={12}>
        <Switch {...args} isDisabled onChange={() => {}} isChecked={false} />
        <Switch {...args} isDisabled onChange={() => {}} isChecked />
      </Box>
    )
  },
}

const WithHint: TStory = {
  args: {
    hintText: 'Выберите значение от 0 до 100.',
  },
}

export { DocsPreview, Disabled, WithHint }
export default meta
