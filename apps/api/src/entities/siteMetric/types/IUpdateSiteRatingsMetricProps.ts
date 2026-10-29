import type { ClientSession } from "mongoose"

interface IUpdateSiteRatingsMetricProps {
  sum: number
  count: number
  session: ClientSession
}

export type { IUpdateSiteRatingsMetricProps }
