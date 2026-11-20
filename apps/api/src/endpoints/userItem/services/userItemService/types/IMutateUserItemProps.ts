import type { ClientSession, HydratedDocument, Types } from "mongoose"

import type { UserItem } from "@entities/userItem/schemas/userItem.schema"

interface IMutateUserItemProps {
  id: Types.ObjectId
  mutate: (
    userItem: HydratedDocument<UserItem>,
    session: ClientSession,
  ) => void | Promise<void>

  isCompletedAndUnratedRequired?: boolean
}

export type { IMutateUserItemProps }
