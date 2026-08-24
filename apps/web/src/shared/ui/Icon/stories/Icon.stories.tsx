import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Box } from '@shared/ui/Box'
import { Text } from '@shared/ui/Text'
import { Icon } from '../core/Icon'
import { ICON_COMPONENTS } from '../static/ICON_COMPONENTS'
import type { TIconName } from '../types/TIconName'

const iconNames = Object.keys(ICON_COMPONENTS) as TIconName[]

const meta = {
  title: 'Shared/UI/Icon',
  component: Icon,
  tags: ['autodocs'],
  args: {
    name: 'alertCircle',
    size: 24,
  },
  argTypes: {
    className: {
      control: { type: 'text' },
      table: { type: { summary: 'string' } },
    },
    name: {
      control: { type: 'select' },
      options: iconNames,
      table: { type: { summary: 'TIconName' } },
    },
    ref: {
      control: false,
      table: {
        type: { summary: 'Ref<SVGSVGElement>' },
      },
    },
    render: {
      control: false,
      table: {
        type: { summary: 'useRender.ComponentProps<"svg">["render"]' },
      },
    },
    size: {
      control: { type: 'select' },
      options: [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48],
      table: { type: { summary: 'TIconSize' } },
    },
  },
} satisfies Meta<typeof Icon>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Sizes: TStory = {
  render: (args) => {
    return (
      <Box alignItems="center" gap={16}>
        <Icon name={args.name} size={16} />
        <Icon name={args.name} size={24} />
        <Icon name={args.name} size={32} />
        <Icon name={args.name} size={40} />
      </Box>
    )
  },
}

const AllIcons: TStory = {
  render: (args) => {
    return (
      <Box flexWrap="wrap" gap={16}>
        {iconNames.map((iconName) => {
          return (
            <Box
              alignItems="center"
              flexDirection="column"
              gap={8}
              key={iconName}
              style={{ width: 80 }}
            >
              <Icon name={iconName} size={args.size} />
              <Text fontSize={12}>{iconName}</Text>
            </Box>
          )
        })}
      </Box>
    )
  },
}

export { DocsPreview, AllIcons, Sizes }
export default meta
