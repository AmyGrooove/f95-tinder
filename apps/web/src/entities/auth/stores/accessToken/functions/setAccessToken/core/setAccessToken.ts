import { setAccessTokenEvent } from '../../../core/accessTokenStore'

const setAccessToken = (accessToken: string | null) => {
  setAccessTokenEvent(accessToken)
}

export { setAccessToken }
