import type { TCnValue } from '../types/TCnValue'

const cn = (...classNames: TCnValue[]): string => {
  const normalizedClassNames = classNames.flatMap((className) => {
    if (!className) {
      return []
    }

    if (typeof className === 'string') {
      return [className]
    }

    return Object.entries(className)
      .filter(([, isEnabled]) => {
        return isEnabled
      })
      .map(([currentClassName]) => {
        return currentClassName
      })
  })

  return normalizedClassNames.join(' ')
}

export { cn }
