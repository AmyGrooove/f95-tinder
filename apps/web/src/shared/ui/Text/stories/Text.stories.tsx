import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Box } from '@shared/ui/Box'
import { Text } from '../core/Text'

const meta = {
  title: 'Shared/UI/Text',
  component: Text,
  tags: ['autodocs'],
  args: {
    children: 'The quick brown fox jumps over the lazy dog.',
    fontSize: 16,
    weight: 400,
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
    fontSize: {
      control: { type: 'radio' },
      options: [12, 16, 20, 24, 28, 32, 40],
      table: {
        type: { summary: 'TTextFontSize' },
        defaultValue: { summary: '16' },
      },
    },
    maxLines: {
      control: { type: 'number', min: 1 },
      table: {
        type: { summary: 'number' },
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
    weight: {
      control: { type: 'radio' },
      options: [400, 700],
      table: {
        type: { summary: 'TTextWeight' },
        defaultValue: { summary: '400' },
      },
    },
  },
} satisfies Meta<typeof Text>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const ClampedContent: TStory = {
  args: {
    maxLines: 2,
  },
  render: (args) => {
    return (
      <Box style={{ maxWidth: 320 }}>
        <Text {...args} render={<p />}>
          {args.children} {args.children} {args.children} {args.children}{' '}
          {args.children}
        </Text>
      </Box>
    )
  },
}

const FontSizes: TStory = {
  render: (args) => {
    return (
      <Box alignItems="start" flexDirection="column" gap={12}>
        <Text fontSize={12} weight={args.weight}>
          {args.children}
        </Text>
        <Text weight={args.weight}>{args.children}</Text>
        <Text fontSize={20} weight={args.weight}>
          {args.children}
        </Text>
        <Text fontSize={24} weight={args.weight}>
          {args.children}
        </Text>
        <Text fontSize={28} weight={args.weight}>
          {args.children}
        </Text>
        <Text fontSize={32} weight={args.weight}>
          {args.children}
        </Text>
        <Text fontSize={40} weight={args.weight}>
          {args.children}
        </Text>
      </Box>
    )
  },
}

const Weights: TStory = {
  render: (args) => {
    return (
      <Box alignItems="start" flexDirection="column" gap={12}>
        <Text fontSize={args.fontSize} weight={400}>
          {args.children}
        </Text>
        <Text fontSize={args.fontSize} weight={700}>
          {args.children}
        </Text>
      </Box>
    )
  },
}

export { DocsPreview, ClampedContent, FontSizes, Weights }
export default meta
