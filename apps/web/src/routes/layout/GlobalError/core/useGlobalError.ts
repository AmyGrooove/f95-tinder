import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import type { IGlobalErrorProps } from '../types/IGlobalErrorProps'

const useGlobalError = (props: IGlobalErrorProps) => {
  const { error, reset } = props

  const router = useRouter()

  const handleReloadPageClick = () => {
    reset()
  }

  const handleGoToMainClick = () => {
    router.push('/')
  }

  useEffect(() => {
    console.error('Unhandled application error', error)
  }, [error])

  return {
    handleGoToMainClick,
    handleReloadPageClick,
  }
}

export { useGlobalError }
