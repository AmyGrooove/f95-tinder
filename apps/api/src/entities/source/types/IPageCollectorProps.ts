import type { IJobContext } from "@infrastructure/jobs/types/IJobContext"

interface IPageCollectorProps<TState, TPage> {
  context: IJobContext
  initialState: TState
  getStateKey: (state: TState) => string
  fetchPage: (state: TState) => Promise<TPage>
  processPage: (page: TPage) => Promise<{ isContinuing: boolean }>
  getNextState: (page: TPage, state: TState) => TState | undefined
}

export type { IPageCollectorProps }
