import type { ClientSession, Types } from "mongoose"

import type { IUserItemMetricState } from "./IUserItemMetricState"

interface IUpdateUserItemMetricsProps {
  itemId: Types.ObjectId
  previous: IUserItemMetricState | null
  next: IUserItemMetricState | null
  session: ClientSession
}

export type { IUpdateUserItemMetricsProps }
