import { Injectable } from "@nestjs/common"

import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { NonRetryableJobError } from "@infrastructure/jobs/errors/NonRetryableJobError"
import { isNil } from "@shared/functions/checks/isNil"

import type { IPageCollectionResult } from "../types/IPageCollectionResult"
import type { IPageCollectorProps } from "../types/IPageCollectorProps"

@Injectable()
class PageCollectorService {
  async collect<TState, TPage>(
    props: IPageCollectorProps<TState, TPage>,
  ): Promise<IPageCollectionResult> {
    const {
      context,
      initialState,
      getStateKey,
      fetchPage,
      processPage,
      getNextState,
    } = props

    const visitedStates = new Set<string>()
    let state = initialState
    let processedPages = 0

    while (true) {
      await context.throwIfCancelled()

      const stateKey = getStateKey(state)

      if (visitedStates.has(stateKey)) {
        throw new NonRetryableJobError(DICTIONARY.source.repeatedPage)
      }

      visitedStates.add(stateKey)

      const page = await fetchPage(state)

      await context.throwIfCancelled()

      const { isContinuing } = await processPage(page)
      processedPages += 1

      await context.throwIfCancelled()

      if (!isContinuing) {
        return { processedPages, reason: "stopped" }
      }

      const nextState = getNextState(page, state)

      if (isNil(nextState)) {
        return { processedPages, reason: "completed" }
      }

      state = nextState
    }
  }
}

export { PageCollectorService }
