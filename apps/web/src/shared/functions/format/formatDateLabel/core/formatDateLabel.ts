import dayjs from 'dayjs'
import { isEmptyString } from '@shared/functions/checks/isEmptyString'
import { isNil } from '@shared/functions/checks/isNil'
import { isString } from '@shared/functions/checks/isString'
import { DICTIONARY } from '@shared/static/DICTIONARY'

const formatDateLabel = (dateValue: string | number | null | undefined) => {
  if (isNil(dateValue) || isEmptyString(dateValue)) {
    return DICTIONARY.common.dateNotSpecified
  }

  if (isString(dateValue)) {
    const calendarDate = dateValue.match(/^\d{4}-\d{2}-\d{2}(?=$|[T ])/u)?.[0]

    if (
      !isNil(calendarDate) &&
      dayjs(calendarDate).format('YYYY-MM-DD') !== calendarDate
    ) {
      return DICTIONARY.common.dateNotSpecified
    }
  }

  const parsedDate = dayjs(dateValue)

  if (!parsedDate.isValid()) {
    return DICTIONARY.common.dateNotSpecified
  }

  return parsedDate.format('DD.MM.YYYY')
}

export { formatDateLabel }
