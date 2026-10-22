import type { Types } from "mongoose"

import type { UserCollection } from "../schemas/userCollection.schema"

interface IUpsertUserCollectionReactionProps {
  userId: Types.ObjectId
  collectionId: Types.ObjectId
  reaction: Partial<Pick<UserCollection, "isFavorite" | "rating" | "isHidden">>
}

export type { IUpsertUserCollectionReactionProps }
