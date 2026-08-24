import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Carousel } from '../core/Carousel'

const items = [
  <div
    key="red"
    style={{
      backgroundColor: 'var(--color-specific-alpha)',
      height: 180,
      width: 180,
    }}
  />,
  <div
    key="orange"
    style={{
      backgroundColor: 'var(--color-specific-beta)',
      height: 180,
      width: 180,
    }}
  />,
  <div
    key="yellow"
    style={{
      backgroundColor: 'var(--color-specific-gamma)',
      height: 180,
      width: 180,
    }}
  />,
  <div
    key="green"
    style={{
      backgroundColor: 'var(--color-specific-delta)',
      height: 180,
      width: 180,
    }}
  />,
]

const meta = {
  title: 'Shared/UI/Carousel',
  component: Carousel,
  tags: ['autodocs'],
  args: {
    gap: 12,
    isCentered: false,
    isDraggable: true,
    isLoop: false,
    isNavigationVisible: true,
    items: [],
  },
  argTypes: {
    items: {
      control: false,
      table: {
        type: { summary: 'ReactElement[]' },
      },
    },
    isNavigationVisible: {
      control: { type: 'boolean' },
      table: {
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    isDraggable: {
      control: { type: 'boolean' },
      table: {
        defaultValue: { summary: 'true' },
        type: { summary: 'boolean' },
      },
    },
    autoScrollInterval: {
      control: { type: 'number' },
      table: {
        type: { summary: 'number' },
      },
    },
    gap: {
      control: { type: 'radio' },
      options: [12, 16, 20, 24],
      table: {
        defaultValue: { summary: '12' },
        type: { summary: 'TCarouselGap' },
      },
    },
    isCentered: {
      control: { type: 'boolean' },
      table: {
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
    isLoop: {
      control: { type: 'boolean' },
      table: {
        defaultValue: { summary: 'false' },
        type: { summary: 'boolean' },
      },
    },
  },
  render: (args) => {
    return (
      <div style={{ width: 800 }}>
        <Carousel {...args} items={[...items, ...items]} />
      </div>
    )
  },
} satisfies Meta<typeof Carousel>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const DisabledDragging: TStory = {
  args: {
    isDraggable: false,
  },
}

const AutomaticMovement: TStory = {
  args: {
    autoScrollInterval: 2000,
    isLoop: true,
  },
}

const Centered: TStory = {
  args: {
    isCentered: true,
  },
}

const CenteredLooping: TStory = {
  args: {
    isCentered: true,
    isLoop: true,
  },
}

const Gaps: TStory = {
  render: (args) => {
    const moreItems = [...items, ...items]

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          width: 800,
        }}
      >
        <Carousel {...args} items={moreItems} gap={12} />
        <Carousel {...args} items={moreItems} gap={16} />
        <Carousel {...args} items={moreItems} gap={20} />
        <Carousel {...args} items={moreItems} gap={24} />
      </div>
    )
  },
}

export {
  DocsPreview,
  Gaps,
  AutomaticMovement,
  Centered,
  CenteredLooping,
  DisabledDragging,
}
export default meta
