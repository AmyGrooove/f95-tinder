'use client'

import { Box } from '@shared/ui/Box'
import { Button } from '@shared/ui/Button'
import { Text } from '@shared/ui/Text'
import { DICTIONARY } from '@shared/static/DICTIONARY'

import { useForbidden } from './useForbidden'
import st from './Forbidden.module.scss'

const Forbidden = () => {
  const { handleGoToMainClick } = useForbidden()

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
            {DICTIONARY.pages.forbidden.title}
          </Text>
          <Text className={st.code} fontSize={32} weight={700}>
            {DICTIONARY.pages.forbidden.code}
          </Text>
        </Box>
        <Button
          className={st.button}
          onClick={handleGoToMainClick}
          size="large"
        >
          {DICTIONARY.pages.forbidden.goToMain}
        </Button>
      </Box>
    </Box>
  )
}

export { Forbidden }
