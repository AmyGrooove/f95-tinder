'use client'

import { Box } from '@shared/ui/Box'
import { Button } from '@shared/ui/Button'
import { Text } from '@shared/ui/Text'
import { DICTIONARY } from '@shared/static/DICTIONARY'

import { useUnauthorized } from './useUnauthorized'
import st from './Unauthorized.module.scss'

const Unauthorized = () => {
  const { handleAuthorizeClick, handleGoToMainClick } = useUnauthorized()

  return (
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
            {DICTIONARY.pages.unauthorized.title}
          </Text>
          <Text className={st.code} fontSize={32} weight={700}>
            {DICTIONARY.pages.unauthorized.code}
          </Text>
        </Box>
        <Button
          className={st.button}
          onClick={handleAuthorizeClick}
          size="large"
        >
          {DICTIONARY.pages.unauthorized.authorize}
        </Button>
        <Button
          className={st.button}
          onClick={handleGoToMainClick}
          size="large"
        >
          {DICTIONARY.pages.unauthorized.goToMain}
        </Button>
      </Box>
    </Box>
  )
}

export { Unauthorized }
