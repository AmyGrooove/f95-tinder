import { isNil } from '@shared/functions/checks/isNil'

const formatNumberInputValue = (value: number | null) => {
  if (isNil(value)) {
    return ''
  }

  return value
    .toLocaleString('ru-RU')
    .replaceAll('\u00a0', ' ')
    .replaceAll('\u202f', ' ')
}

export { formatNumberInputValue }
