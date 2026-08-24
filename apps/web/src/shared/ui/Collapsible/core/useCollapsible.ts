import { useEffect, useState } from 'react'
import type { TransitionEvent } from 'react'
import type { ICollapsibleProps } from '../types/ICollapsibleProps'
import { CLOSE_TRANSITION_TIMEOUT } from '../static/CLOSE_TRANSITION_TIMEOUT'

const useCollapsible = (props: ICollapsibleProps) => {
  const { children, className, isOpen } = props

  const [isMounted, setIsMounted] = useState(isOpen)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || isOpen) {
      return
    }

    setIsMounted(false)
  }

  useEffect(() => {
    if (isOpen) {
      if (!isMounted) {
        const animationFrameId = window.requestAnimationFrame(() => {
          setIsMounted(true)
        })

        return () => {
          window.cancelAnimationFrame(animationFrameId)
        }
      }

      const animationFrameId = window.requestAnimationFrame(() => {
        setIsPanelOpen(true)
      })

      return () => {
        window.cancelAnimationFrame(animationFrameId)
      }
    }

    if (!isMounted) {
      return undefined
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      setIsPanelOpen(false)
    })

    const timeoutId = window.setTimeout(() => {
      setIsMounted(false)
    }, CLOSE_TRANSITION_TIMEOUT)

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      window.clearTimeout(timeoutId)
    }
  }, [isMounted, isOpen])

  return {
    children,
    className,
    isMounted,
    isPanelOpen,
    onTransitionEnd: handleTransitionEnd,
  }
}

export { useCollapsible }
