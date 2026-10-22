import type { Types } from "mongoose"

import type { IUpsertUserCollectionReactionProps } from "@entities/userCollection/types/IUpsertUserCollectionReactionProps"

interface IUpdateCollectionReactionProps {
  id: Types.ObjectId
  reaction: IUpsertUserCollectionReactionProps["reaction"]
}

export type { IUpdateCollectionReactionProps }
