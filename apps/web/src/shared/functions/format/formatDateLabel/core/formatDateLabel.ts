import dayjs from 'dayjs'

const formatDateLabel = (
  dateValue: string | number | null | undefined,
): string => {
  if (!dateValue) {
    return 'Не указана'
  }

  const parsedDate = dayjs(dateValue)

  if (!parsedDate.isValid()) {
    return String(dateValue)
  }

  return parsedDate.format('DD.MM.YYYY')
}

export { formatDateLabel }
