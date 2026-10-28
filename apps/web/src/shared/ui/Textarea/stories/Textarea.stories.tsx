import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Textarea } from '../core/Textarea'

const meta = {
  title: 'Shared/UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    onChange: () => {},
    value: '',
  },
  argTypes: {
    className: { control: 'text' },
    onBlur: { control: false },
    onChange: { control: false },
    onFocus: { control: false },
    placeholder: { control: 'text' },
    ref: { control: false },
    value: { control: 'text' },
    errorText: {
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
    isDisabled: {
      control: { type: 'boolean' },
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    label: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)

    return <Textarea {...args} onChange={setValue} value={value} />
  },
} satisfies Meta<typeof Textarea>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const WithLabel: TStory = {
  args: {
    label: 'Email',
  },
}

const WithHint: TStory = {
  args: {
    hintText: 'Мы не отправляем спам.',
  },
}

const WithPlaceholder: TStory = {
  args: {
    placeholder: 'Найти аниме',
  },
}

const WithError: TStory = {
  args: {
    errorText: 'Введите корректный email.',
  },
}

const Disabled: TStory = {
  args: {
    isDisabled: true,
  },
}

const ResizableWidth: TStory = {
  name: 'Переносы при изменении ширины',
  args: {
    label: 'Автоматическая высота',
    hintText:
      'Потяните правый нижний угол контейнера. Высота должна меняться без редактирования текста.',
    value:
      'Один и тот же текст занимает разное количество строк в зависимости от ширины поля. При сужении контейнера поле увеличивается до максимальной высоты, после чего появляется прокрутка. При расширении контейнера поле снова уменьшается, а лишняя прокрутка исчезает.',
  },
  decorators: [
    (Story) => {
      return (
        <div
          style={{
            maxWidth: '100%',
            minWidth: 160,
            overflow: 'auto',
            resize: 'horizontal',
            width: 480,
          }}
        >
          <Story />
        </div>
      )
    },
  ],
}

export {
  DocsPreview,
  WithLabel,
  WithHint,
  WithPlaceholder,
  WithError,
  Disabled,
  ResizableWidth,
}
export default meta
