import type { Types } from "mongoose"

import type { UpdateCollectionBodyDto } from "../dto/updateCollection.body"

interface IPrepareItemChangesProps {
  id: Types.ObjectId
  changes: UpdateCollectionBodyDto["items"]
  groupIds: Set<string>
}

export type { IPrepareItemChangesProps }
