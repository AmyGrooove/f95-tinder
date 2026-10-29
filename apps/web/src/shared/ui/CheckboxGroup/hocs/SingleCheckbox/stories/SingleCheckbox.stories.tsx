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
    isChecked: false,
  },
  render: (args) => {
    const [isChecked, setIsChecked] = useState(args.isChecked)

    return (
      <SingleCheckbox
        className={args.className}
        hintText={args.hintText}
        isDisabled={args.isDisabled}
        label={args.label}
        onChange={setIsChecked}
        ref={args.ref}
        isChecked={isChecked}
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
