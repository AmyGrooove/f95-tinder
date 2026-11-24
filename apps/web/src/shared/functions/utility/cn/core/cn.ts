import { isNil } from '@shared/functions/checks/isNil'
import type { TCnValue } from '../types/TCnValue'

const cn = (...classNames: TCnValue[]) => {
  const normalizedClassNames = classNames.flatMap((className) => {
    if (isNil(className) || className === false) {
      return []
    }

    if (typeof className === 'string') {
      return [className]
    }

    return Object.entries(className)
      .filter((entry) => {
        const [, isEnabled] = entry

        return !isNil(isEnabled) && isEnabled
      })
      .map((entry) => {
        const [currentClassName] = entry

        return currentClassName
      })
  })

  return normalizedClassNames.join(' ')
}

export { cn }
