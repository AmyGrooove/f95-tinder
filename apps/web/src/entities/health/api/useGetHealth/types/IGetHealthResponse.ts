interface IGetHealthResponse {
  mongo: { status: 'error' | 'ok' }
  redis: { status: 'error' | 'ok' }
  status: 'error' | 'ok'
}

export type { IGetHealthResponse }
