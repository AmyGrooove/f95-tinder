import { useEffect, useState } from 'react'

const usePrefersReducedMotion = () => {
  const [isReducedMotion, setIsReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleReducedMotionChange = () => {
      setIsReducedMotion(mediaQueryList.matches)
    }

    handleReducedMotionChange()
    mediaQueryList.addEventListener('change', handleReducedMotionChange)

    return () => {
      mediaQueryList.removeEventListener('change', handleReducedMotionChange)
    }
  }, [])

  return {
    isReducedMotion,
  }
}

export { usePrefersReducedMotion }
