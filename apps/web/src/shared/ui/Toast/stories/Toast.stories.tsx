import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Toast as ToastPrimitive } from '@base-ui/react/toast'
import { Box } from '@shared/ui/Box'
import { Button } from '@shared/ui/Button'
import { Toast } from '../core/Toast'
import { closeToast } from '../functions/closeToast'
import { showPromiseToast } from '../functions/showPromiseToast'
import { showToast } from '../functions/showToast'
import { updateToast } from '../functions/updateToast'
import { TOAST_MANAGER } from '../static/TOAST_MANAGER'

const meta = {
  title: 'Shared/UI/Toast',
  component: Toast,
  tags: ['autodocs'],
  decorators: [
    (Story) => {
      return (
        <ToastPrimitive.Provider
          limit={3}
          timeout={5000}
          toastManager={TOAST_MANAGER}
        >
          <Story />
          <Toast />
        </ToastPrimitive.Provider>
      )
    },
  ],
} satisfies Meta<typeof Toast>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
  render: () => {
    return <></>
  },
}

const Types: TStory = {
  render: () => {
    const handleShowSuccessToast = () => {
      showToast({
        description: 'Операция завершена',
        title: 'Успешно',
        type: 'success',
      })
    }

    const handleShowInfoToast = () => {
      showToast({
        description: 'Доступна новая версия',
        title: 'Информация',
        type: 'info',
      })
    }

    const handleShowWarningToast = () => {
      showToast({
        description: 'Проверьте заполнение формы',
        title: 'Внимание',
        type: 'warning',
      })
    }

    const handleShowErrorToast = () => {
      showToast({
        description: 'Не удалось сохранить данные',
        title: 'Ошибка',
        type: 'error',
      })
    }

    const handleShowLoadingToast = () => {
      showToast({
        description: 'Подождите немного',
        title: 'Загрузка',
        type: 'loading',
      })
    }

    return (
      <Box flexWrap="wrap" gap={12}>
        <Button onClick={handleShowSuccessToast}>Success</Button>
        <Button onClick={handleShowInfoToast}>Info</Button>
        <Button onClick={handleShowWarningToast}>Warning</Button>
        <Button onClick={handleShowErrorToast}>Error</Button>
        <Button onClick={handleShowLoadingToast}>Loading</Button>
      </Box>
    )
  },
}

const WithAction: TStory = {
  render: () => {
    const handleShowToast = () => {
      const toastId = showToast({
        action: {
          label: 'Отменить',
          onClick: () => {
            closeToast(toastId)
          },
        },
        description: 'У вас есть несколько секунд на отмену',
        title: 'Элемент удалён',
      })
    }

    return <Button onClick={handleShowToast}>Показать действие</Button>
  },
}

const PromiseToast: TStory = {
  name: 'Promise',
  render: () => {
    const handleRunPromise = () => {
      const request = new Promise<string>((resolve) => {
        window.setTimeout(() => {
          resolve('Данные обновлены')
        }, 1200)
      })

      void showPromiseToast<string>({
        error: {
          description: 'Повторите попытку позже',
          title: 'Не удалось обновить данные',
          type: 'error',
        },
        loading: {
          description: 'Пожалуйста, подождите',
          title: 'Загрузка',
          type: 'loading',
        },
        promise: request,
        success: (message) => {
          return { description: message, title: 'Готово', type: 'success' }
        },
      })
    }

    return <Button onClick={handleRunPromise}>Запустить promise</Button>
  },
}

const Stack: TStory = {
  render: () => {
    const handleShowStack = () => {
      Array.from({ length: 5 }, (_, index) => {
        showToast({
          description: `Описание уведомления №${index + 1}`,
          title: `Уведомление №${index + 1}`,
        })
      })
    }

    return <Button onClick={handleShowStack}>Показать стек</Button>
  },
}

const Update: TStory = {
  render: () => {
    const handleShowToast = () => {
      const toastId = showToast({
        description: 'Пожалуйста, подождите',
        title: 'Обновление профиля',
        type: 'loading',
      })

      window.setTimeout(() => {
        updateToast({
          description: 'Все изменения сохранены',
          title: 'Профиль обновлён',
          toastId,
          type: 'success',
        })
      }, 1200)
    }

    return <Button onClick={handleShowToast}>Обновить уведомление</Button>
  },
}

const LongContent: TStory = {
  render: () => {
    const handleShowToast = () => {
      showToast({
        description:
          'Это длинное описание проверяет перенос строк и сохраняет доступными действие и кнопку закрытия.',
        title:
          'Уведомление с достаточно длинным заголовком для проверки адаптивной раскладки',
        type: 'info',
      })
    }

    return <Button onClick={handleShowToast}>Показать длинное</Button>
  },
}

export {
  DocsPreview,
  LongContent,
  PromiseToast,
  Stack,
  Types,
  Update,
  WithAction,
}
export default meta
