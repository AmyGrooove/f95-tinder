interface IJobHandlerOptions {
  attempts?: number
  retryDelay?: number
  retryDelays?: number[]
  concurrency?: number
}

export type { IJobHandlerOptions }
