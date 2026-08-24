import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Box } from '@shared/ui/Box'
import { Button } from '@shared/ui/Button'
import { Kbd } from '../core/Kbd'

const meta = {
  title: 'Shared/UI/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  args: {
    children: 'Ctrl',
  },
  argTypes: {
    children: {
      control: { type: 'text' },
      table: {
        type: { summary: 'ReactNode' },
      },
    },
    className: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    ref: {
      control: false,
      table: {
        type: { summary: 'Ref<HTMLElement>' },
      },
    },
    render: {
      control: false,
      table: {
        type: { summary: 'useRender.ComponentProps<"kbd">["render"]' },
      },
    },
  },
} satisfies Meta<typeof Kbd>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Modifiers: TStory = {
  render: () => {
    return (
      <Box alignItems="center" gap={4}>
        <Kbd>⌘</Kbd>
        <Kbd>⇧</Kbd>
        <Kbd>⌥</Kbd>
        <Kbd>⌃</Kbd>
      </Box>
    )
  },
}

const Shortcut: TStory = {
  render: () => {
    return (
      <Box alignItems="center" gap={4}>
        <Kbd>Ctrl</Kbd>
        <span>+</span>
        <Kbd>B</Kbd>
      </Box>
    )
  },
}

const InButton: TStory = {
  render: () => {
    return (
      <Button size="medium" variant="primary">
        Accept
        <Kbd>⏎</Kbd>
      </Button>
    )
  },
}

export { DocsPreview, InButton, Modifiers, Shortcut }
export default meta
