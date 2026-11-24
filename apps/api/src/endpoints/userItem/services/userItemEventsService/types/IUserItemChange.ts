import type { Types } from "mongoose"

import type { UserItem } from "@entities/userItem/schemas/userItem.schema"

interface IUserItemChange {
  readonly user: Types.ObjectId
  readonly item: Types.ObjectId
  readonly before: Readonly<UserItem> | null
  readonly after: Readonly<UserItem> | null
}

export type { IUserItemChange }
