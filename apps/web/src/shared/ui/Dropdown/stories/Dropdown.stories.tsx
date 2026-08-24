import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Box } from '@shared/ui/Box'
import { Button } from '@shared/ui/Button'
import { Icon } from '@shared/ui/Icon'
import { Dropdown } from '../core/Dropdown'

const meta = {
  title: 'Shared/UI/Dropdown',
  component: Dropdown,
  tags: ['autodocs'],
  args: {
    align: 'center',
    children: (
      <Button>
        <Icon name="plus" />
      </Button>
    ),
    content: 'Содержимое выпадающего списка',
    isDisabled: false,
    isOpen: undefined,
    side: 'bottom',
  },
  argTypes: {
    align: {
      control: { type: 'radio' },
      options: ['start', 'center', 'end'],
      table: {
        type: { summary: 'TDropdownAlign' },
        defaultValue: { summary: 'center' },
      },
    },
    children: {
      control: false,
      table: {
        type: { summary: 'ReactElement' },
      },
    },
    className: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    content: {
      control: { type: 'text' },
      table: {
        type: { summary: 'ReactNode' },
      },
    },
    isDisabled: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    isOpen: {
      control: false,
      table: {
        type: { summary: 'boolean' },
      },
    },
    onOpenChange: {
      control: false,
      table: {
        type: { summary: '(isOpen: boolean) => void' },
      },
    },
    side: {
      control: { type: 'radio' },
      options: ['top', 'right', 'bottom', 'left'],
      table: {
        type: { summary: 'TDropdownSide' },
        defaultValue: { summary: 'bottom' },
      },
    },
  },
  render: (args) => {
    return (
      <Dropdown
        align={args.align}
        className={args.className}
        content={args.content}
        isDisabled={args.isDisabled}
        isOpen={args.isOpen}
        onOpenChange={args.onOpenChange}
        side={args.side}
      >
        {args.children}
      </Dropdown>
    )
  },
} satisfies Meta<typeof Dropdown>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Disabled: TStory = {
  args: {
    isDisabled: true,
  },
}

const OpenedExternally: TStory = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false)

    return (
      <Box alignItems="center" gap={8}>
        <Button
          onClick={() => {
            setIsOpen(true)
          }}
        >
          Открыть снаружи
        </Button>
        <Dropdown
          align={args.align}
          className={args.className}
          content={args.content}
          isDisabled={args.isDisabled}
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          side={args.side}
        >
          {args.children}
        </Dropdown>
      </Box>
    )
  },
}

export { DocsPreview, Disabled, OpenedExternally }
export default meta
