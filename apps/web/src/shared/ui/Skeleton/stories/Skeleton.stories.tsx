import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Box } from '@shared/ui/Box'
import { Skeleton } from '../core/Skeleton'

const meta = {
  title: 'Shared/UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  args: {
    isFlexShrinkDisabled: false,
  },
  argTypes: {
    className: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    isFlexShrinkDisabled: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
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
        type: { summary: 'useRender.ComponentProps<"div">["render"]' },
      },
    },
  },
  render: (args) => {
    return (
      <Skeleton {...args} render={<div style={{ height: 24, width: 240 }} />} />
    )
  },
} satisfies Meta<typeof Skeleton>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Layout: TStory = {
  render: (args) => {
    return (
      <Box alignItems="center" gap={12} style={{ maxWidth: 360 }}>
        <Skeleton
          isFlexShrinkDisabled={args.isFlexShrinkDisabled}
          render={
            <div style={{ borderRadius: '50%', height: 48, width: 48 }} />
          }
        />
        <Box flexDirection="column" gap={8} style={{ width: '100%' }}>
          <Skeleton
            isFlexShrinkDisabled={args.isFlexShrinkDisabled}
            render={<div style={{ height: 16, width: '60%' }} />}
          />
          <Skeleton
            isFlexShrinkDisabled={args.isFlexShrinkDisabled}
            render={<div style={{ height: 16 }} />}
          />
        </Box>
      </Box>
    )
  },
}

const FlexShrinkDisabled: TStory = {
  args: {
    isFlexShrinkDisabled: true,
  },
  render: (args) => {
    return (
      <Box gap={12} style={{ maxWidth: 240 }}>
        <Skeleton
          isFlexShrinkDisabled={args.isFlexShrinkDisabled}
          render={<div style={{ height: 32, width: 160 }} />}
        />
        <Skeleton
          isFlexShrinkDisabled={args.isFlexShrinkDisabled}
          render={<div style={{ height: 32, width: 160 }} />}
        />
      </Box>
    )
  },
}

const FlexShrinkAllowed: TStory = {
  ...FlexShrinkDisabled,
  name: 'Сжатие разрешено',
  args: { isFlexShrinkDisabled: false },
}

export { DocsPreview, FlexShrinkAllowed, FlexShrinkDisabled, Layout }
export default meta
