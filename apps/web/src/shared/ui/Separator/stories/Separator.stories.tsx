import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Box } from '@shared/ui/Box'
import { Separator } from '../core/Separator'

const meta = {
  title: 'Shared/UI/Separator',
  component: Separator,
  tags: ['autodocs'],
  args: {
    orientation: 'horizontal',
  },
  argTypes: {
    className: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    orientation: {
      control: { type: 'radio' },
      options: ['horizontal', 'vertical'],
      table: {
        type: { summary: 'TSeparatorOrientation' },
        defaultValue: { summary: 'horizontal' },
      },
    },
    ref: {
      control: false,
      table: {
        type: { summary: 'Ref<HTMLDivElement>' },
      },
    },
  },
  render: (args) => {
    return (
      <Box
        flexDirection={args.orientation === 'horizontal' ? 'column' : 'row'}
        gap={12}
      >
        <div
          style={{
            backgroundColor: 'var(--color-accent-deepest)',
            height: 64,
            width: 64,
          }}
        />
        <Separator {...args} />
        <div
          style={{
            backgroundColor: 'var(--color-accent-deepest)',
            height: 64,
            width: 64,
          }}
        />
      </Box>
    )
  },
} satisfies Meta<typeof Separator>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Horizontal: TStory = {
  args: {
    orientation: 'horizontal',
  },
}

const Vertical: TStory = {
  args: {
    orientation: 'vertical',
  },
}

export { DocsPreview, Horizontal, Vertical }
export default meta
