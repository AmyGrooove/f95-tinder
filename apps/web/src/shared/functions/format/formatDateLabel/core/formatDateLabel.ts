import dayjs from 'dayjs'
import { isNil } from '@shared/functions/checks/isNil'

const formatDateLabel = (
  dateValue: string | number | null | undefined,
): string => {
  if (isNil(dateValue) || dateValue === '' || dateValue === 0) {
    return 'Не указана'
  }

  const parsedDate = dayjs(dateValue)

  if (!parsedDate.isValid()) {
    return String(dateValue)
  }

  return parsedDate.format('DD.MM.YYYY')
}

export { formatDateLabel }
