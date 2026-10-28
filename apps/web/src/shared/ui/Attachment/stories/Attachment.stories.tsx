import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Box } from '@shared/ui/Box'
import { Button } from '@shared/ui/Button'
import { Text } from '@shared/ui/Text'
import { Attachment } from '../core/Attachment'

const meta = {
  title: 'Shared/UI/Attachment',
  component: Attachment,
  tags: ['autodocs'],
  args: {
    alt: 'Предпросмотр вложения',
    src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="steelblue"/><circle cx="120" cy="80" r="48" fill="gold"/></svg>')}`,
  },
  argTypes: {
    className: { control: 'text' },
    ref: { control: false },
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
      <Box style={{ display: 'grid', height: 160, width: 240 }}>
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
    src: 'data:image/png;base64,broken',
  },
}

const BelowViewport: TStory = {
  name: 'Ленивая загрузка ниже экрана',
  render: (args) => {
    return (
      <Box flexDirection="column" gap={16}>
        <Text>Прокрутите вниз к изображению.</Text>
        <Box style={{ minHeight: '200vh' }}>
          <Text>Изображение находится ниже первого экрана.</Text>
        </Box>
        <Box style={{ display: 'grid', height: 160, width: 240 }}>
          <Attachment {...args} />
        </Box>
      </Box>
    )
  },
}

const SourceChange: TStory = {
  name: 'Смена изображения и восстановление после ошибки',
  render: (args) => {
    const [isBroken, setIsBroken] = useState(false)

    return (
      <Box flexDirection="column" gap={16}>
        <Button
          onClick={() => {
            setIsBroken((isCurrentlyBroken) => !isCurrentlyBroken)
          }}
        >
          {isBroken ? 'Загрузить изображение' : 'Показать ошибку'}
        </Button>
        <Box style={{ display: 'grid', height: 160, width: 240 }}>
          <Attachment
            {...args}
            src={isBroken ? 'data:image/png;base64,broken' : args.src}
          />
        </Box>
      </Box>
    )
  },
}

export { BelowViewport, DocsPreview, Error, SourceChange }
export default meta
