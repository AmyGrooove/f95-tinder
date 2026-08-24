import { Box } from '@shared/ui/Box'
import { Button } from '@shared/ui/Button'
import { Text } from '@shared/ui/Text'
import { DICTIONARY } from '@shared/static/DICTIONARY'

import { useGlobalError } from './useGlobalError'
import st from './GlobalError.module.scss'

import type { IGlobalErrorProps } from '../types/IGlobalErrorProps'

const GlobalError = (props: IGlobalErrorProps) => {
  const { handleGoToMainClick, handleReloadPageClick } = useGlobalError(props)

  return (
    <html lang="ru">
      <body>
        <Box
          alignItems="center"
          justifyContent="center"
          render={<main />}
          className={st.root}
        >
          <Box
            alignItems="center"
            className={st.content}
            flexDirection="column"
            gap={16}
          >
            <Box alignItems="center" gap={12}>
              <Text fontSize={32} render={<h1 />} weight={700}>
                {DICTIONARY.pages.serverError.title}
              </Text>
              <Text className={st.code} fontSize={32} weight={700}>
                {DICTIONARY.pages.serverError.code}
              </Text>
            </Box>
            <Text fontSize={20} render={<p />}>
              {DICTIONARY.pages.serverError.description}
            </Text>
            <Button
              className={st.button}
              onClick={handleReloadPageClick}
              size="large"
            >
              {DICTIONARY.pages.serverError.reload}
            </Button>
            <Button
              className={st.button}
              onClick={handleGoToMainClick}
              size="large"
            >
              {DICTIONARY.pages.serverError.goToMain}
            </Button>
          </Box>
        </Box>
      </body>
    </html>
  )
}

export { GlobalError }
