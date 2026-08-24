import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import type { CSSProperties } from 'react'
import { Box } from '../core/Box'

const meta = {
  title: 'Shared/UI/Box',
  component: Box,
  tags: ['autodocs'],
  args: {
    alignItems: 'normal',
    children: null,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 0,
    isFocusable: false,
    justifyContent: 'normal',
  },
  argTypes: {
    alignItems: {
      control: { type: 'select' },
      options: ['normal', 'start', 'center', 'end', 'stretch', 'baseline'],
      table: {
        type: { summary: 'TBoxAlign' },
        defaultValue: { summary: 'normal' },
      },
    },
    flexDirection: {
      control: { type: 'radio' },
      options: ['row', 'rowReverse', 'column', 'columnReverse'],
      table: {
        type: { summary: 'TBoxDirection' },
        defaultValue: { summary: 'row' },
      },
    },
    flexWrap: {
      control: { type: 'radio' },
      options: ['nowrap', 'wrap', 'wrapReverse'],
      table: {
        type: { summary: 'TBoxWrap' },
        defaultValue: { summary: 'nowrap' },
      },
    },
    gap: {
      control: { type: 'select' },
      options: [0, 4, 8, 12, 16, 20, 24, 32, 40, 64],
      table: {
        type: { summary: 'TBoxGap' },
        defaultValue: { summary: '0' },
      },
    },
    justifyContent: {
      control: { type: 'select' },
      options: [
        'normal',
        'start',
        'center',
        'end',
        'spaceBetween',
        'spaceAround',
        'spaceEvenly',
      ],
      table: {
        type: { summary: 'TBoxJustify' },
        defaultValue: { summary: 'normal' },
      },
    },
    isFocusable: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
  },
  render: (args) => {
    const itemStyle: CSSProperties = {
      backgroundColor: 'var(--color-specific-delta)',
      height: 48,
      width: 48,
      flexShrink: 0,
      borderRadius: 'var(--border-radius-12)',
      alignItems: 'center',
      justifyContent: 'center',
      display: 'flex',
    }

    return (
      <Box
        {...args}
        style={{
          border: '1px dashed var(--color-specific-delta)',
          padding: 12,
          height: 500,
          width: 500,
        }}
      >
        <div style={itemStyle}>1</div>
        <div style={itemStyle}>2</div>
        <div style={itemStyle}>3</div>
        <div style={itemStyle}>4</div>
        <div style={itemStyle}>5</div>
        <div style={itemStyle}>6</div>
      </Box>
    )
  },
} satisfies Meta<typeof Box>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const AlignItems: TStory = {
  args: {
    alignItems: 'center',
    gap: 12,
  },
}

const FlexDirection: TStory = {
  args: {
    flexDirection: 'column',
    gap: 12,
  },
}

const FlexWrap: TStory = {
  args: {
    flexWrap: 'wrap',
    gap: 12,
  },
}

const Gap: TStory = {
  args: {
    gap: 12,
  },
}

const JustifyContent: TStory = {
  args: {
    justifyContent: 'spaceBetween',
    gap: 12,
  },
}

const IsFocusable: TStory = {
  args: {
    isFocusable: true,
    gap: 12,
  },
}

export {
  DocsPreview,
  AlignItems,
  FlexDirection,
  FlexWrap,
  Gap,
  IsFocusable,
  JustifyContent,
}
export default meta
