import { createEvent, createStore } from 'effector'

const setAccessTokenEvent = createEvent<string | null>()

const $accessToken = createStore<string | null>(null).on(
  setAccessTokenEvent,
  (_, accessToken) => {
    return accessToken
  },
)

export { $accessToken, setAccessTokenEvent }
