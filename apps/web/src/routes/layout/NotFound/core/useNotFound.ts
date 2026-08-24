import { useRouter } from 'next/navigation'

const useNotFound = () => {
  const router = useRouter()

  const handleGoToDefaultClick = () => {
    router.push('/')
  }

  return {
    handleGoToDefaultClick,
  }
}

export { useNotFound }
