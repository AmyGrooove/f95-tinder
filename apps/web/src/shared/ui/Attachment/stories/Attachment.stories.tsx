import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Box } from '@shared/ui/Box'
import { Attachment } from '../core/Attachment'

const meta = {
  title: 'Shared/UI/Attachment',
  component: Attachment,
  tags: ['autodocs'],
  args: {
    alt: 'Предпросмотр вложения',
    src: 'https://cdn.androidadult.com/wp-content/uploads/2024/09/Nene-has-a-desire-for-exposure-APK-Android-Adult-Hentai-Game-Download-Featured.png',
  },
  argTypes: {
    alt: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
    src: {
      control: { type: 'text' },
      table: {
        type: { summary: 'string' },
      },
    },
  },
  render: (args) => {
    return (
      <Box style={{ height: 160, width: 240 }}>
        <Attachment {...args} />
      </Box>
    )
  },
} satisfies Meta<typeof Attachment>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Error: TStory = {
  args: {
    src: 'https://example.invalid/attachment.jpg',
  },
}

export { DocsPreview, Error }
export default meta
