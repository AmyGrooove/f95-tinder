import type { ClientSession, Types } from "mongoose"

import type { IUserItemStatsState } from "./IUserItemStatsState"

interface IUpdateUserItemStatsProps {
  itemId: Types.ObjectId
  previous: IUserItemStatsState | null
  next: IUserItemStatsState | null
  session: ClientSession
}

export type { IUpdateUserItemStatsProps }
