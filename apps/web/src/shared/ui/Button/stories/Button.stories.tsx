import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Box } from '@shared/ui/Box'
import { Icon } from '@shared/ui/Icon'
import { Button } from '../core/Button'

const meta = {
  title: 'Shared/UI/Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: 'Button',
    isDisabled: false,
    isLoading: false,
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
      options: ['primary', 'outlined', 'secondary', 'ghost'],
      table: {
        type: { summary: 'TButtonVariant' },
        defaultValue: { summary: 'primary' },
      },
    },
    size: {
      control: { type: 'radio' },
      options: ['small', 'medium', 'large'],
      table: {
        type: { summary: 'TButtonSize' },
        defaultValue: { summary: 'medium' },
      },
    },
    isDisabled: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    isLoading: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
  },
} satisfies Meta<typeof Button>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Sizes: TStory = {
  render: (args) => {
    return (
      <Box alignItems="center" gap={12}>
        <Button {...args} size="small">
          {args.children}
        </Button>
        <Button {...args} size="medium">
          {args.children}
        </Button>
        <Button {...args} size="large">
          {args.children}
        </Button>
      </Box>
    )
  },
}

const Variants: TStory = {
  render: (args) => {
    return (
      <Box flexWrap="wrap" gap={12}>
        <Button {...args} variant="primary">
          {args.children}
        </Button>
        <Button {...args} variant="outlined">
          {args.children}
        </Button>
        <Button {...args} variant="secondary">
          {args.children}
        </Button>
        <Button {...args} variant="ghost">
          {args.children}
        </Button>
      </Box>
    )
  },
}

const Disabled: TStory = {
  args: {
    isDisabled: true,
  },
}

const Loading: TStory = {
  args: {
    isLoading: true,
  },
}

const WithIcons: TStory = {
  render: (args) => {
    return (
      <Box flexWrap="wrap" gap={12}>
        <Button {...args}>
          <Icon name="plus" />
          {args.children}
        </Button>
        <Button {...args}>
          {args.children}
          <Icon name="download" />
        </Button>
      </Box>
    )
  },
}

const IconOnly: TStory = {
  render: (args) => {
    return (
      <Button {...args}>
        <Icon name="search" />
      </Button>
    )
  },
}

export { DocsPreview, Disabled, IconOnly, Loading, Sizes, Variants, WithIcons }
export default meta
