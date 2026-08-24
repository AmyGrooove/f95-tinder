import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SingleCheckbox } from '../core/SingleCheckbox'

const meta = {
  title: 'Shared/UI/SingleCheckbox',
  component: SingleCheckbox,
  tags: ['autodocs'],
  args: {
    isDisabled: false,
    label: 'Получать уведомления на почту',
    onChange: () => {},
    value: false,
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)

    return (
      <SingleCheckbox
        className={args.className}
        hintText={args.hintText}
        isDisabled={args.isDisabled}
        label={args.label}
        onChange={setValue}
        ref={args.ref}
        value={value}
      />
    )
  },
} satisfies Meta<typeof SingleCheckbox>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

export { DocsPreview }
export default meta
