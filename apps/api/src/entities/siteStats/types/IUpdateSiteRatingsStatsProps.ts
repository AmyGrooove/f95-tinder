import type { ClientSession } from "mongoose"

interface IUpdateSiteRatingsStatsProps {
  sum: number
  count: number
  session: ClientSession
}

export type { IUpdateSiteRatingsStatsProps }
