import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SingleToggle } from '../core/SingleToggle'

const meta = {
  title: 'Shared/UI/SingleToggle',
  component: SingleToggle,
  tags: ['autodocs'],
  args: {
    icon: 'filter',
    isDisabled: false,
    label: 'Показывать фильтры',
    onChange: () => {},
    value: false,
  },
  render: (args) => {
    const [value, setValue] = useState(args.value)

    return (
      <SingleToggle
        className={args.className}
        hintText={args.hintText}
        icon={args.icon}
        isDisabled={args.isDisabled}
        label={args.label}
        onChange={setValue}
        ref={args.ref}
        value={value}
      />
    )
  },
} satisfies Meta<typeof SingleToggle>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

export { DocsPreview }
export default meta
