'use client'

import { Box } from '@shared/ui/Box'
import { Text } from '@shared/ui/Text'
import { Button } from '@shared/ui/Button'
import { DICTIONARY } from '@shared/static/DICTIONARY'

import { useNotFound } from './useNotFound'
import st from './NotFound.module.scss'
import { Attachment } from '@shared/ui/Attachment'

const NotFound = () => {
  const { handleGoToDefaultClick } = useNotFound()

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
            {DICTIONARY.pages.notFound.title}
          </Text>
          <Text className={st.code} fontSize={32} weight={700}>
            {DICTIONARY.pages.notFound.code}
          </Text>
        </Box>
        <Text fontSize={20} render={<p />}>
          {DICTIONARY.pages.notFound.description}
        </Text>
        <Attachment className={st.image} src="" />
        <Button
          className={st.button}
          onClick={handleGoToDefaultClick}
          size="large"
        >
          {DICTIONARY.pages.notFound.goToMain}
        </Button>
      </Box>
    </Box>
  )
}

export { NotFound }
