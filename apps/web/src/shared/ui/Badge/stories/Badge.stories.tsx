import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Box } from '@shared/ui/Box'
import { Icon } from '@shared/ui/Icon'
import { Badge } from '../core/Badge'

const meta = {
  title: 'Shared/UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: {
    children: 'Badge',
    size: 'medium',
    variant: 'primary',
  },
  argTypes: {
    children: {
      control: { type: 'text' },
      table: {
        type: { summary: 'ReactNode' },
      },
    },
    variant: {
      control: { type: 'radio' },
      options: ['primary', 'outlined', 'secondary'],
      table: {
        type: { summary: 'TBadgeVariant' },
        defaultValue: { summary: 'primary' },
      },
    },
    size: {
      control: { type: 'radio' },
      options: ['small', 'medium', 'large'],
      table: {
        type: { summary: 'TBadgeSize' },
        defaultValue: { summary: 'medium' },
      },
    },
  },
} satisfies Meta<typeof Badge>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Sizes: TStory = {
  render: (args) => {
    return (
      <Box alignItems="center" gap={12}>
        <Badge {...args} size="small">
          {args.children}
        </Badge>
        <Badge {...args} size="medium">
          {args.children}
        </Badge>
        <Badge {...args} size="large">
          {args.children}
        </Badge>
      </Box>
    )
  },
}

const Variants: TStory = {
  render: (args) => {
    return (
      <Box alignItems="center" gap={12}>
        <Badge {...args} variant="primary">
          {args.children}
        </Badge>
        <Badge {...args} variant="outlined">
          {args.children}
        </Badge>
        <Badge {...args} variant="secondary">
          {args.children}
        </Badge>
      </Box>
    )
  },
}

const WithIcons: TStory = {
  render: (args) => {
    return (
      <Box alignItems="center" gap={12}>
        <Badge {...args}>
          <Icon name="plus" />
          {args.children}
        </Badge>
        <Badge {...args}>
          {args.children}
          <Icon name="download" />
        </Badge>
      </Box>
    )
  },
}

const IconOnly: TStory = {
  render: (args) => {
    return (
      <Badge size={args.size} variant={args.variant}>
        <Icon name="search" />
      </Badge>
    )
  },
}

export { DocsPreview, IconOnly, Sizes, Variants, WithIcons }
export default meta
