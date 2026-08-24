import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from '@shared/ui/Button'
import { Dialog } from '../core/Dialog'
import { setDialog } from '../stores/dialogStore'

const meta = {
  title: 'Shared/UI/Dialog',
  component: Dialog,
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>

type TStory = StoryObj<typeof meta>

const ShortContent: TStory = {
  render: () => {
    const handleOpenDialog = () => {
      setDialog({
        content: (
          <p>
            Содержимое полностью передаётся вызывающим кодом. Закрыть диалог
            можно крестиком, Escape, кликом по фону или свайпом вниз на
            мобильном.
          </p>
        ),
        title: 'Готовый диалог',
      })
    }

    return (
      <>
        <Dialog />
        <Button onClick={handleOpenDialog}>Открыть диалог</Button>
      </>
    )
  },
}

const ScrollableContent: TStory = {
  render: () => {
    const handleOpenDialog = () => {
      setDialog({
        content: (
          <div>
            {Array.from({ length: 24 }, (_, index) => {
              return <p key={index}>Строка содержимого №{index + 1}</p>
            })}
          </div>
        ),
        title: 'Прокручиваемое содержимое',
      })
    }

    return (
      <>
        <Dialog />
        <Button onClick={handleOpenDialog}>Открыть длинный диалог</Button>
      </>
    )
  },
}

export { ScrollableContent, ShortContent }
export default meta
