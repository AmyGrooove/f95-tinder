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
  render: (args) => {
    const [value, setValue] = useState<number | null>(args.value)

    return (
      <NumberInput
        className={args.className}
        errorText={args.errorText}
        hintText={args.hintText}
        icon={args.icon}
        isDisabled={args.isDisabled}
        label={args.label}
        onChange={setValue}
        placeholder={args.placeholder}
        value={value}
      />
    )
  },
} satisfies Meta<typeof NumberInput>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

export { DocsPreview }
export default meta
