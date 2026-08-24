import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from '@shared/ui/Button'
import { Icon } from '@shared/ui/Icon'
import { Tooltip } from '../core/Tooltip'

const meta = {
  title: 'Shared/UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  args: {
    align: 'center',
    children: (
      <Button>
        <Icon name="plus" />
      </Button>
    ),
    content: 'Добавить в библиотеку',
    isDisabled: false,
    side: 'top',
  },
  argTypes: {
    align: {
      control: { type: 'radio' },
      options: ['start', 'center', 'end'],
      table: {
        type: { summary: 'TTooltipAlign' },
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
    side: {
      control: { type: 'radio' },
      options: ['top', 'right', 'bottom', 'left'],
      table: {
        type: { summary: 'TTooltipSide' },
        defaultValue: { summary: 'top' },
      },
    },
  },
  render: (args) => {
    return (
      <Tooltip
        align={args.align}
        className={args.className}
        content={args.content}
        isDisabled={args.isDisabled}
        side={args.side}
      >
        {args.children}
      </Tooltip>
    )
  },
} satisfies Meta<typeof Tooltip>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Disabled: TStory = {
  args: {
    isDisabled: true,
  },
}

export { DocsPreview, Disabled }
export default meta
