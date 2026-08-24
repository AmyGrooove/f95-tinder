import { useRouter } from 'next/navigation'

const useUnauthorized = () => {
  const router = useRouter()

  const handleAuthorizeClick = () => {}

  const handleGoToMainClick = () => {
    router.push('/')
  }

  return {
    handleAuthorizeClick,
    handleGoToMainClick,
  }
}

export { useUnauthorized }
