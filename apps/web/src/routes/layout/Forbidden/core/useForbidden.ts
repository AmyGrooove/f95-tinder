import { useRouter } from 'next/navigation'

const useForbidden = () => {
  const router = useRouter()

  const handleGoToMainClick = () => {
    router.push('/')
  }

  return {
    handleGoToMainClick,
  }
}

export { useForbidden }
