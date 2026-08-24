import { useEffect, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Progress } from '../core/Progress'

const meta = {
  title: 'Shared/UI/Progress',
  component: Progress,
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    hintText: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    errorText: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    label: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    max: {
      control: { type: 'number' },
      table: {
        type: { summary: 'number' },
        defaultValue: { summary: '100' },
      },
    },
    ref: {
      control: false,
      table: {
        type: { summary: 'Ref<HTMLDivElement>' },
      },
    },
    value: {
      control: { type: 'number' },
      table: {
        type: { summary: 'number | null' },
      },
    },
  },
} satisfies Meta<typeof Progress>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Animated: TStory = {
  render: () => {
    const [value, setValue] = useState(0)

    useEffect(() => {
      const interval = window.setInterval(() => {
        setValue((currentValue) => {
          if (currentValue === 100) {
            return 0
          }

          return currentValue + 10
        })
      }, 500)

      return () => {
        window.clearInterval(interval)
      }
    }, [])

    return <Progress value={value} />
  },
}

const Indeterminate: TStory = {
  args: {
    value: null,
  },
}

const Error: TStory = {
  args: {
    errorText: 'Не удалось завершить загрузку',
    value: 40,
  },
}

const WithLabel: TStory = {
  args: {
    label: 'Загрузка файлов',
  },
}

const WithHint: TStory = {
  args: {
    hintText: 'Завершится примерно через 2 минуты',
  },
}

export { DocsPreview, Animated, Error, Indeterminate, WithLabel, WithHint }
export default meta
