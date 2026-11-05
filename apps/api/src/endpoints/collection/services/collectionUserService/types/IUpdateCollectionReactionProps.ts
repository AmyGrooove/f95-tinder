import type { Types } from "mongoose"

import type { IUpsertUserCollectionReactionProps } from "@entities/userCollection/services/userCollectionRepository"

interface IUpdateCollectionReactionProps {
  id: Types.ObjectId
  reaction: IUpsertUserCollectionReactionProps["reaction"]
}

export type { IUpdateCollectionReactionProps }
