import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { NumberInput } from '../core/NumberInput'

const meta = {
  title: 'Shared/UI/NumberInput',
  component: NumberInput,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    label: 'Количество',
    onChange: () => {},
    placeholder: 'Введите число',
    value: 14235324,
  },
  argTypes: {
    className: { control: 'text' },
    errorText: { control: 'text' },
    hintText: { control: 'text' },
    icon: {
      control: 'select',
      options: ['search', 'eye', 'info'],
    },
    isDisabled: { control: 'boolean' },
    label: { control: 'text' },
    onBlur: { control: false },
    onChange: { control: false },
    onFocus: { control: false },
    placeholder: { control: 'text' },
    ref: { control: false },
    value: {
      control: {
        type: 'number',
        min: 0,
        max: Number.MAX_SAFE_INTEGER,
        step: 1,
      },
      description:
        'Вводятся целые числа от 0 до Number.MAX_SAFE_INTEGER. Переполнение отклоняется, пустое поле возвращает null.',
    },
  },
  render: (args) => {
    const [value, setValue] = useState<number | null>(args.value)

    return <NumberInput {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof NumberInput>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const MaximumSafeInteger: TStory = {
  name: 'Максимальное безопасное целое',
  args: {
    hintText: 'Попробуйте дописать цифру: значение должно остаться прежним.',
    value: Number.MAX_SAFE_INTEGER,
  },
}

const Empty: TStory = {
  name: 'Пустое значение',
  args: { value: null },
}

const Zero: TStory = {
  name: 'Ноль',
  args: { value: 0 },
}

export { DocsPreview, Empty, MaximumSafeInteger, Zero }
export default meta
