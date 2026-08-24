import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Box } from '@shared/ui/Box'
import { CheckboxGroup } from '@shared/ui/CheckboxGroup'
import { Text } from '@shared/ui/Text'
import { Collapsible } from '../core/Collapsible'

const meta = {
  title: 'Shared/UI/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
  args: {
    isOpen: false,
    children: null,
  },
  argTypes: {
    children: {
      control: false,
      table: {
        type: { summary: 'ReactNode' },
      },
    },
    isOpen: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
  },
  render: (args) => {
    const [isOpen, setIsOpen] = useState(args.isOpen)

    return (
      <Box flexDirection="column" gap={8}>
        <CheckboxGroup
          onChange={(nextValue) => {
            setIsOpen(nextValue.includes('content'))
          }}
          options={[
            {
              label: 'Показать скрываемый контент',
              value: 'content',
            },
          ]}
          value={isOpen ? ['content'] : []}
        />
        <Text>Контент перед раскрывающейся областью</Text>
        <Collapsible {...args} isOpen={isOpen}>
          <Box flexDirection="column" gap={8}>
            <Text>Скрываемый контент</Text>
            <Text>Панель раскрывается до высоты своего содержимого.</Text>
          </Box>
        </Collapsible>
        <Text>Контент после раскрывающейся области</Text>
      </Box>
    )
  },
} satisfies Meta<typeof Collapsible>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

export { DocsPreview }
export default meta
