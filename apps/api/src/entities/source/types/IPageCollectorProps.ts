import type { JobContext } from "@infrastructure/jobs/types/JobContext"

interface IPageCollectorProps<TState, TPage> {
  context: JobContext
  initialState: TState
  getStateKey: (state: TState) => string
  fetchPage: (state: TState) => Promise<TPage>
  processPage: (page: TPage) => Promise<{ isContinuing: boolean }>
  getNextState: (page: TPage, state: TState) => TState | undefined
}

export type { IPageCollectorProps }
