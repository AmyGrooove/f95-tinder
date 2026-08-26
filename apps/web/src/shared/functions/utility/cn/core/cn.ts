import { isNil } from '@shared/functions/checks/isNil'
import type { TCnValue } from '../types/TCnValue'

const cn = (...classNames: TCnValue[]): string => {
  const normalizedClassNames = classNames.flatMap((className) => {
    if (isNil(className) || className === false) {
      return []
    }

    if (typeof className === 'string') {
      return [className]
    }

    return Object.entries(className)
      .filter(([, isEnabled]) => {
        return !isNil(isEnabled) && isEnabled
      })
      .map(([currentClassName]) => {
        return currentClassName
      })
  })

  return normalizedClassNames.join(' ')
}

export { cn }
