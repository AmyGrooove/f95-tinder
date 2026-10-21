import { getTestApplication } from "@test/setup/setupIntegration"

const readConfirmationCode = () => {
  const message = getTestApplication().mail.messages.at(-1)
  const code = message?.text?.match(/(?:^|\s)(\d{6})(?=\s|$)/)?.[1]

  if (code === undefined) {
    throw new Error("В тестовом письме отсутствует код подтверждения")
  }

  return code
}

export { readConfirmationCode }
